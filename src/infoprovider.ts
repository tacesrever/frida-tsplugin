import * as tslib from "typescript/lib/tsserverlibrary";
import {log} from './logger';
import request from 'sync-request';

export interface ClassInfoProvider {
    getClassName: () => string;
    getExtendClassNames: () => string[];
    getPropInfoProvider: (name: string) => FieldInfoProvider | MethodInfoProvider;
    getFieldInfoProvider: (name: string) => FieldInfoProvider;
    getMethodInfoProvider: (name: string) => MethodInfoProvider;
    getCompletionDetail: (symbolName: string) => tslib.CompletionEntryDetails;
    getCompletionEntries: (originEntries?: tslib.CompletionEntry[]) => tslib.CompletionEntry[];
    getDeclare: () => string;
}

export interface MethodInfoProvider {
    getClassName: () => string;
    getPropInfoProvider: (name: string) => ClassInfoProvider | MethodInfoProvider;
    hasOverload: () => boolean;
    getOverloadInfoProvider: (argTypes?: string[]) => MethodInfoProvider;
    getReturnClassName: (argTypes?: string[]) => string;
    getReturnInfoProvider: (argTypes?: string[]) => ClassInfoProvider;
    getParamClassNames: () => string[];
    getCompletionDetail: (symbolName: string) => tslib.CompletionEntryDetails;
    getCompletionEntries: (originEntries?: tslib.CompletionEntry[]) => tslib.CompletionEntry[];
    getDeclare: (argTypes?: string[]) => string;
}

export interface FieldInfoProvider {
    getClassName: () => string;
    getPropInfoProvider: (name: string) => ClassInfoProvider;
    getCompletionDetail: (symbolName: string) => tslib.CompletionEntryDetails;
    getCompletionEntries: (originEntries?: tslib.CompletionEntry[]) => tslib.CompletionEntry[];
    getDeclare: () => string;
}

declare interface JavaMethodInfo {
    returnType: string
    argumentTypes: string[]
}
declare interface JavaClassInfo {
    alltypes: string[]
    fields: {
        [index: string]: string
    }
    methods: {
        [index: string]: JavaMethodInfo[]
    }
    wrapperProps: string[]
}
let javaLoader: JavaProviderLoader;
export class JavaProviderLoader {
    classCache: Map<string, JavaClassInfoProvider> = new Map();
    baseurl: string
    constructor(private config: any) {
        this.baseurl = `http://${config.host || "127.0.0.1"}:${config.port || "28042"}`;
        javaLoader = this;
    }

    getProviderByName(className: string): JavaClassInfoProvider {
        if(this.classCache[className] !== undefined) {
            return this.classCache[className];
        }
        const res = request("GET", this.baseurl + "/getJavaClassInfo?className=" + className, {
            timeout: 3000
        });
        if(res.statusCode !== 200) {
            this.classCache[className] = null;
            return null;
        }
        this.classCache[className] = new JavaClassInfoProvider(JSON.parse(res.getBody("utf-8")));
        return this.classCache[className];
        
    }
}

let objCLoader: ObjCProviderLoader;
export class ObjCProviderLoader {
    constructor() {

    }
}

export class JavaClassInfoProvider implements ClassInfoProvider {
    methods: Map<string, JavaMethodInfoProvider> = new Map();
    fields: Map<string, JavaFieldInfoProvider> = new Map();
    cachedEntries: tslib.CompletionEntry[] = undefined;
    constructor(public classInfo: JavaClassInfo) {
        for(const name in classInfo.methods) {
            this.methods.set(name, new JavaMethodInfoProvider(classInfo.alltypes[0], name, classInfo.methods[name]));
        }
        this.methods.set("$init", this.methods.get("$new"));
        for(const name in classInfo.fields) {
            this.fields.set(name, new JavaFieldInfoProvider(classInfo.alltypes[0], name, classInfo.fields[name]));
        }
    }

    getClassName() {
        return this.classInfo.alltypes[0];
    }

    getExtendClassNames() {
        return this.classInfo.alltypes;
    }

    getPropInfoProvider(name: string) {
        if(this.getMethodInfoProvider(name)) return this.getMethodInfoProvider(name);
        return this.getFieldInfoProvider(name);
    }

    getFieldInfoProvider(fieldName: string) {
        return this.fields.get(fieldName);
    }

    getMethodInfoProvider(methodName: string) {
        return this.methods.get(methodName);
    }

    getDeclare() {
        return "class " + this.classInfo.alltypes[0];
    }

    getCompletionDetail(name: string) {
        const isMethod = this.methods.has(name);
        if(!isMethod && !this.getFieldInfoProvider(name)) return undefined;
        let details: tslib.CompletionEntryDetails = {
            name: name,
            kind: isMethod? tslib.ScriptElementKind.memberFunctionElement:
                    tslib.ScriptElementKind.memberVariableElement,
            displayParts: [],
            documentation: [],
            kindModifiers: ''
        }
        details.displayParts.push({
            text: '(',
            kind: 'punctuation'
        });
        details.displayParts.push({
            text: isMethod? 'method': 'field',
            kind: 'text'
        });
        details.displayParts.push({
            text: ')',
            kind: 'punctuation'
        });
        details.displayParts.push({
            text: ' ',
            kind: 'space'
        });
        details.displayParts.push({
            text: this.getPropInfoProvider(name).getDeclare(),
            kind: 'text'
        });
        return details;
    }

    getCompletionEntries(originEntries?: tslib.CompletionEntry[]) {
        if(this.cachedEntries !== undefined) return this.cachedEntries;
        this.cachedEntries = [];
        for(const name of this.classInfo.wrapperProps) {
            let entry: tslib.CompletionEntry = {
                name: name,
                sortText: name,
                kind: tslib.ScriptElementKind.memberVariableElement,
                source: ""
            };
            this.cachedEntries.push(entry);
        }
        
        this.methods.forEach((method, name) => {
            let entry: tslib.CompletionEntry = {
                name: name,
                sortText: name,
                kind: tslib.ScriptElementKind.memberFunctionElement,
                source: "Java_c:" + this.classInfo.alltypes[0]
            };
            this.cachedEntries.push(entry);
        });

        this.fields.forEach((field, name) => {
            let entry: tslib.CompletionEntry = {
                sortText: name,
                name: name,
                source: "Java_c:" + this.classInfo.alltypes[0],
                kind: tslib.ScriptElementKind.memberVariableElement
            };
            this.cachedEntries.push(entry);
        });
        return this.cachedEntries;
    }
}

export class JavaMethodInfoProvider implements MethodInfoProvider {
    cachedEntries: tslib.CompletionEntry[] = undefined;
    constructor(public className: string, public name: string, public methodInfo: JavaMethodInfo[]) {
    }

    getClassName() {
        return '';
    }

    hasOverload() {
        return this.methodInfo.length > 1;
    }

    getPropInfoProvider(name: string) {
        return undefined;
    }

    getMethodInfo(argTypes?: string[]) {
        if(argTypes === undefined)
            return this.methodInfo[0];
        let midx = 0;
        for(const types of this.methodInfo) {
            if(argTypes.length === types.argumentTypes.length) {
                let hit = true;
                for(let i = 0; hit && i < types.argumentTypes.length; ++i) {
                    if(argTypes[i] !== null && types.argumentTypes[i] !== argTypes[i]) {
                        hit = false;
                        let argClass = javaLoader.getProviderByName(argTypes[i]);
                        for(const subType of argClass.getExtendClassNames()) {
                            if(subType === types.argumentTypes[i]) {
                                hit = true;
                                break;
                            }
                        }
                    }
                }
                if(hit) return this.methodInfo[midx];
            }
            midx++;
        }
        return undefined;
    }

    getOverloadInfoProvider(argTypes?: string[]) {
        const method = this.getMethodInfo(argTypes);
        if(method === undefined) return undefined;
        const aMethod = new JavaMethodInfoProvider(this.className, this.name, [method]);
        return aMethod;
    }

    getReturnClassName(argTypes?: string[]): string {
        const method = this.getMethodInfo(argTypes);
        if(method === undefined) return undefined;
        return method.returnType;
    }

    getDeclare(argTypes?: string[]) {
        const method = this.getMethodInfo(argTypes);
        if(method === undefined) return undefined;
        if(method.argumentTypes.length === 0) return `${method.returnType} ${this.className}.${this.name}()`;
        else return `${method.returnType} ${this.className}.${this.name}('${method.argumentTypes.join("', '")}')`;
    }

    getParamClassNames() {
        return this.methodInfo[0].argumentTypes;
    }

    getReturnInfoProvider(argTypes?: string[]) {
        let className = this.getReturnClassName(argTypes);
        return className? javaLoader.getProviderByName(className): undefined;
    }

    getCompletionDetail(name: string) {
        log("getCompletionDetail", name);
        if(name.indexOf("overload(") !== 0) return undefined;

        let argTypes = undefined;
        if(name.length > 12)
            argTypes = name.slice(10, -2).split("', '");
        let details: tslib.CompletionEntryDetails = {
            name: name,
            kind: tslib.ScriptElementKind.memberFunctionElement,
            displayParts: [],
            documentation: [],
            kindModifiers: ''
        }
        details.displayParts.push({
            text: this.getDeclare(argTypes),
            kind: 'text'
        });
        return details;
    }

    getCompletionEntries(originEntries?: tslib.CompletionEntry[]) {
        log("getCompletionEntries", JSON.stringify(this.methodInfo));
        if(this.cachedEntries !== undefined) return this.cachedEntries;
        if(this.methodInfo.length === 0) return undefined;
        this.cachedEntries = [];
        const fridaMethodWarpperProps = [
            "methodName",
            "holder",
            "type",
            "handle",
            "implementation",
            "returnType",
            "argumentTypes",
            "canInvokeWith",
            "clone",
            "invoke"
        ]
        if(this.methodInfo.length > 1) {
            fridaMethodWarpperProps.push("overloads");
        }
        fridaMethodWarpperProps.forEach(fieldName => {
            this.cachedEntries.push({
                sortText: fieldName,
                name: fieldName,
                source: "Java_m:" + this.className + '.' + this.name,
                kind: tslib.ScriptElementKind.memberVariableElement
            });
        });
        if(this.methodInfo.length > 1) {
            this.methodInfo.forEach(info => {
                let overloadArg = "'" + info.argumentTypes.join("', '") + "'";
    
                this.cachedEntries.push({
                    sortText: "overload(",
                    name: "overload(" + overloadArg + ")",
                    source: "Java_m:" + this.className + '.' + this.name,
                    kind: tslib.ScriptElementKind.memberVariableElement
                });
            });
        }
        return this.cachedEntries;
    }
}

export class JavaFieldInfoProvider implements FieldInfoProvider {
    cachedEntries: tslib.CompletionEntry[] = undefined;
    constructor(public className: string, public name: string, public type: string) {
    }

    getDeclare() {
        return `${this.type} ${this.className}.${this.name}`;
    }

    getClassName() {
        return this.type;
    }

    getPropInfoProvider(name: string) {
        if(name === 'value') {
            return javaLoader.getProviderByName(this.type);
        }
        if(name === 'holder') {
            return javaLoader.getProviderByName(this.className);
        }
        return undefined;
    }

    getCompletionDetail(name: string) {
        if(name !== 'value' && name !== 'holder') return undefined;
        let details: tslib.CompletionEntryDetails = {
            name: name,
            kind: tslib.ScriptElementKind.memberFunctionElement,
            displayParts: [],
            documentation: [],
            kindModifiers: ''
        }
        if(name === 'value') {
            details.displayParts.push({
                text: this.getDeclare(),
                kind: 'text'
            });
        }
        else if(name === 'holder') {
            details.displayParts.push({
                text: javaLoader.getProviderByName(this.className).getDeclare(),
                kind: 'text'
            });
        }
        return details;
    }

    getCompletionEntries(originEntries?: tslib.CompletionEntry[]) {
        if(this.cachedEntries !== undefined) return this.cachedEntries;
        const fridaFieldWarpperProps = [
            "value",
            "holder",
            "fieldType",
            "fieldReturnType"
        ];
        this.cachedEntries = [];
        fridaFieldWarpperProps.forEach(propName => {
            this.cachedEntries.push({
                sortText: propName,
                name: propName,
                source: "Java_f:" + this.className + '.' + this.name,
                kind: tslib.ScriptElementKind.memberVariableElement
            });
        })
        return this.cachedEntries;
    }
}