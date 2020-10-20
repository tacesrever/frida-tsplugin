"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavaFieldInfoProvider = exports.JavaMethodInfoProvider = exports.JavaClassInfoProvider = exports.ObjCProviderLoader = exports.JavaProviderLoader = void 0;
const tslib = require("typescript/lib/tsserverlibrary");
const sync_request_1 = require("sync-request");
let javaLoader;
class JavaProviderLoader {
    constructor(config) {
        this.config = config;
        this.classCache = new Map();
        this.baseurl = `http://${config.host || "127.0.0.1"}:${config.port || "28042"}`;
        javaLoader = this;
    }
    getProviderByName(className) {
        if (this.classCache[className] !== undefined) {
            return this.classCache[className];
        }
        const res = sync_request_1.default("GET", this.baseurl + "/getJavaClassInfo?className=" + className, {
            timeout: 3000
        });
        if (res.statusCode !== 200) {
            this.classCache[className] = null;
            return null;
        }
        this.classCache[className] = new JavaClassInfoProvider(JSON.parse(res.getBody("utf-8")));
        return this.classCache[className];
    }
}
exports.JavaProviderLoader = JavaProviderLoader;
let objCLoader;
class ObjCProviderLoader {
    constructor() {
    }
}
exports.ObjCProviderLoader = ObjCProviderLoader;
class JavaClassInfoProvider {
    constructor(classInfo) {
        this.classInfo = classInfo;
        this.methods = new Map();
        this.fields = new Map();
        this.cachedEntries = undefined;
        for (const name in classInfo.methods) {
            this.methods.set(name, new JavaMethodInfoProvider(classInfo.alltypes[0], name, classInfo.methods[name]));
        }
        this.methods.set("$init", this.methods.get("$new"));
        for (const name in classInfo.fields) {
            this.fields.set(name, new JavaFieldInfoProvider(classInfo.alltypes[0], name, classInfo.fields[name]));
        }
    }
    getClassName() {
        return this.classInfo.alltypes[0];
    }
    getExtendClassNames() {
        return this.classInfo.alltypes;
    }
    getPropInfoProvider(name) {
        if (this.getMethodInfoProvider(name))
            return this.getMethodInfoProvider(name);
        return this.getFieldInfoProvider(name);
    }
    getFieldInfoProvider(fieldName) {
        return this.fields.get(fieldName);
    }
    getMethodInfoProvider(methodName) {
        return this.methods.get(methodName);
    }
    getDeclare() {
        return "class " + this.classInfo.alltypes[0];
    }
    getCompletionDetail(name) {
        const isMethod = this.methods.has(name);
        if (!isMethod && !this.getFieldInfoProvider(name))
            return undefined;
        let details = {
            name: name,
            kind: isMethod ? tslib.ScriptElementKind.memberFunctionElement :
                tslib.ScriptElementKind.memberVariableElement,
            displayParts: [],
            documentation: [],
            kindModifiers: ''
        };
        details.displayParts.push({
            text: '(',
            kind: 'punctuation'
        });
        details.displayParts.push({
            text: isMethod ? 'method' : 'field',
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
    getCompletionEntries(originEntries) {
        if (this.cachedEntries !== undefined)
            return this.cachedEntries;
        this.cachedEntries = [];
        for (const name of this.classInfo.wrapperProps) {
            let entry = {
                name: name,
                sortText: name,
                kind: tslib.ScriptElementKind.memberVariableElement,
                source: ""
            };
            this.cachedEntries.push(entry);
        }
        this.methods.forEach((method, name) => {
            let entry = {
                name: name,
                sortText: name,
                kind: tslib.ScriptElementKind.memberFunctionElement,
                source: "Java_c:" + this.classInfo.alltypes[0]
            };
            this.cachedEntries.push(entry);
        });
        this.fields.forEach((field, name) => {
            let entry = {
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
exports.JavaClassInfoProvider = JavaClassInfoProvider;
class JavaMethodInfoProvider {
    constructor(className, name, methodInfo) {
        this.className = className;
        this.name = name;
        this.methodInfo = methodInfo;
        this.cachedEntries = undefined;
    }
    getClassName() {
        return '';
    }
    hasOverload() {
        return this.methodInfo.length > 1;
    }
    getPropInfoProvider(name) {
        return undefined;
    }
    getMethodInfo(argTypes) {
        if (argTypes === undefined)
            return this.methodInfo[0];
        let midx = 0;
        for (const types of this.methodInfo) {
            if (argTypes.length === types.argumentTypes.length) {
                let hit = true;
                for (let i = 0; hit && i < types.argumentTypes.length; ++i) {
                    if (argTypes[i] !== null && types.argumentTypes[i] !== argTypes[i]) {
                        hit = false;
                        let argClass = javaLoader.getProviderByName(argTypes[i]);
                        for (const subType of argClass.getExtendClassNames()) {
                            if (subType === types.argumentTypes[i]) {
                                hit = true;
                                break;
                            }
                        }
                    }
                }
                if (hit)
                    return this.methodInfo[midx];
            }
            midx++;
        }
        return undefined;
    }
    getOverloadInfoProvider(argTypes) {
        const method = this.getMethodInfo(argTypes);
        if (method === undefined)
            return undefined;
        const aMethod = new JavaMethodInfoProvider(this.className, this.name, [method]);
        return aMethod;
    }
    getReturnClassName(argTypes) {
        const method = this.getMethodInfo(argTypes);
        if (method === undefined)
            return undefined;
        return method.returnType;
    }
    getDeclare(argTypes) {
        const method = this.getMethodInfo(argTypes);
        if (method === undefined)
            return undefined;
        if (method.argumentTypes.length === 0)
            return `${method.returnType} ${this.className}.${this.name}()`;
        else
            return `${method.returnType} ${this.className}.${this.name}('${method.argumentTypes.join("', '")}')`;
    }
    getParamClassNames() {
        return this.methodInfo[0].argumentTypes;
    }
    getReturnInfoProvider(argTypes) {
        let className = this.getReturnClassName(argTypes);
        return className ? javaLoader.getProviderByName(className) : undefined;
    }
    getCompletionDetail(name) {
        if (name.indexOf("overload(") !== 0)
            return undefined;
        let argTypes = undefined;
        if (name.length > 12)
            argTypes = name.slice(10, -2).split("', '");
        let details = {
            name: name,
            kind: tslib.ScriptElementKind.memberFunctionElement,
            displayParts: [],
            documentation: [],
            kindModifiers: ''
        };
        details.displayParts.push({
            text: this.getDeclare(argTypes),
            kind: 'text'
        });
        return details;
    }
    getCompletionEntries(originEntries) {
        if (this.cachedEntries !== undefined)
            return this.cachedEntries;
        if (this.methodInfo.length === 0)
            return undefined;
        this.cachedEntries = [];
        const fridaMethodWarpperProps = [
            "overloads",
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
        ];
        fridaMethodWarpperProps.forEach(fieldName => {
            this.cachedEntries.push({
                sortText: fieldName,
                name: fieldName,
                source: "Java_m:" + this.className + '.' + this.name,
                kind: tslib.ScriptElementKind.memberVariableElement
            });
        });
        this.methodInfo.forEach(info => {
            let overloadArg = "'" + info.argumentTypes.join("', '") + "'";
            this.cachedEntries.push({
                sortText: "overload(",
                name: "overload(" + overloadArg + ")",
                source: "Java_m:" + this.className + '.' + this.name,
                kind: tslib.ScriptElementKind.memberVariableElement
            });
        });
        return this.cachedEntries;
    }
}
exports.JavaMethodInfoProvider = JavaMethodInfoProvider;
class JavaFieldInfoProvider {
    constructor(className, name, type) {
        this.className = className;
        this.name = name;
        this.type = type;
        this.cachedEntries = undefined;
    }
    getDeclare() {
        return `${this.type} ${this.className}.${this.name}`;
    }
    getClassName() {
        return this.type;
    }
    getPropInfoProvider(name) {
        if (name === 'value') {
            return javaLoader.getProviderByName(this.type);
        }
        if (name === 'holder') {
            return javaLoader.getProviderByName(this.className);
        }
        return undefined;
    }
    getCompletionDetail(name) {
        if (name !== 'value' && name !== 'holder')
            return undefined;
        let details = {
            name: name,
            kind: tslib.ScriptElementKind.memberFunctionElement,
            displayParts: [],
            documentation: [],
            kindModifiers: ''
        };
        if (name === 'value') {
            details.displayParts.push({
                text: this.getDeclare(),
                kind: 'text'
            });
        }
        else if (name === 'holder') {
            details.displayParts.push({
                text: javaLoader.getProviderByName(this.className).getDeclare(),
                kind: 'text'
            });
        }
        return details;
    }
    getCompletionEntries(originEntries) {
        if (this.cachedEntries !== undefined)
            return this.cachedEntries;
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
        });
        return this.cachedEntries;
    }
}
exports.JavaFieldInfoProvider = JavaFieldInfoProvider;
