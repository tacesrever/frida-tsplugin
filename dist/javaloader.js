"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib = require("typescript/lib/tsserverlibrary");
const java = require("java");
const fs = require("fs");
const logger_1 = require("./logger");
let loader;
class JavaLoader {
    constructor(classpaths) {
        this.classCache = new Map();
        classpaths.forEach(path => {
            if (fs.existsSync(path)) {
                const stat = fs.lstatSync(path);
                if (stat.isDirectory()) {
                    try {
                        java.classpath.pushDir(path);
                    }
                    catch (e) {
                        logger_1.log(e.stack);
                    }
                    ;
                }
                else if (stat.isFile()) {
                    try {
                        java.classpath.push(path);
                    }
                    catch (e) {
                        logger_1.log(e.stack);
                    }
                    ;
                }
            }
            else {
            }
        });
        loader = this;
    }
    getClass(className) {
        if (this.classCache[className] === undefined) {
            this.classCache[className] = new JavaClass(className);
        }
        return this.classCache[className];
    }
}
exports.JavaLoader = JavaLoader;
class JavaClass {
    constructor(className) {
        this.className = className;
        this.subTypes = [];
        this.methods = new Map();
        this.fields = new Map();
        this.cachedEntries = undefined;
        this.klass = java.findClassSync(className);
        this.klass.getInterfacesSync().forEach(i => {
            this.subTypes.push(i.getNameSync());
        });
        this.methods.set("$new", new JavaMethod("$new"));
        this.methods.set("$init", new JavaMethod("$init"));
        this.klass.getConstructorsSync().forEach(method => {
            this.methods.get("$new").addOverload(method);
            this.methods.get("$init").addOverload(method);
        });
        let currentClass = this.klass;
        while (currentClass) {
            currentClass.getDeclaredMethodsSync().forEach(method => {
                const methodName = method.getNameSync();
                if (this.methods.get(methodName) === undefined) {
                    this.methods.set(methodName, new JavaMethod(methodName));
                }
                this.methods.get(methodName).addOverload(method);
            });
            currentClass.getDeclaredFieldsSync().forEach(field => {
                const fieldName = field.getNameSync();
                if (this.fields.get(fieldName) === undefined) {
                    this.fields.set(fieldName, new JavaField(field));
                }
            });
            this.subTypes.push(currentClass.getNameSync());
            currentClass = currentClass.getSuperclassSync();
        }
    }
    getTypeName() {
        return this.className;
    }
    getSubTypes() {
        return this.subTypes;
    }
    getProp(name) {
        if (this.getMethod(name))
            return this.getMethod(name);
        return this.getField(name);
    }
    getField(fieldName) {
        while (fieldName[0] === '_' && this.fields.get(fieldName) === undefined)
            fieldName = fieldName.substr(1);
        return this.fields.get(fieldName);
    }
    getMethod(methodName) {
        return this.methods.get(methodName);
    }
    getJavaWarpper() {
        return this.klass;
    }
    getCompletionDetails(name) {
        const isMethod = this.methods.has(name);
        if (!isMethod && !this.getField(name))
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
            text: this.getProp(name).getJavaWarpper().toString(),
            kind: 'text'
        });
        return details;
    }
    getCompletionEntries(originEntries) {
        if (this.cachedEntries !== undefined)
            return this.cachedEntries;
        this.cachedEntries = [];
        const fridaClassWarpperProps = {
            // // declared in @types/frida-gum:
            "$alloc": tslib.ScriptElementKind.memberFunctionElement,
            "class": tslib.ScriptElementKind.memberVariableElement,
            "$className": tslib.ScriptElementKind.memberVariableElement,
            "$super": tslib.ScriptElementKind.memberVariableElement,
            // // currently not (or internal):
            "$dispose": tslib.ScriptElementKind.memberFunctionElement,
            "$clone": tslib.ScriptElementKind.memberFunctionElement,
            "$list": tslib.ScriptElementKind.memberFunctionElement,
            "$ownMembers": tslib.ScriptElementKind.memberVariableElement,
            "$s": tslib.ScriptElementKind.memberVariableElement,
            "toJSON": tslib.ScriptElementKind.memberFunctionElement,
            "$isSameObject": tslib.ScriptElementKind.memberFunctionElement,
            "$getCtor": tslib.ScriptElementKind.memberFunctionElement,
            "$borrowClassHandle": tslib.ScriptElementKind.memberFunctionElement,
            "$copyClassHandle": tslib.ScriptElementKind.memberFunctionElement,
            "$has": tslib.ScriptElementKind.memberFunctionElement,
            "$find": tslib.ScriptElementKind.memberFunctionElement
        };
        for (const name in fridaClassWarpperProps) {
            let entry = {
                name: name,
                sortText: name,
                kind: fridaClassWarpperProps[name],
                source: ""
            };
            this.cachedEntries.push(entry);
        }
        let usedNames = [];
        this.methods.forEach((method, name) => {
            if (!usedNames.includes(name))
                usedNames.push(name);
            let entry = {
                name: name,
                sortText: name,
                kind: tslib.ScriptElementKind.memberFunctionElement,
                source: "Java_c:" + this.className
            };
            this.cachedEntries.push(entry);
        });
        this.fields.forEach((field, name) => {
            while (usedNames.includes(name))
                name = '_' + name;
            usedNames.push(name);
            let entry = {
                sortText: name,
                name: name,
                source: "Java_c:" + this.className,
                kind: tslib.ScriptElementKind.memberVariableElement
            };
            this.cachedEntries.push(entry);
        });
        return this.cachedEntries;
    }
}
exports.JavaClass = JavaClass;
class JavaMethod {
    constructor(methodName) {
        this.methodName = methodName;
        this.methods = [];
        this.argTypes = [];
        this.cachedEntries = undefined;
    }
    // as argument?
    getTypeName() {
        return '';
    }
    getOverloadCount() {
        return this.methods.length;
    }
    addOverload(method) {
        this.methods.push(method);
        const argTypes = method.getParameterTypesSync().map(typeclz => {
            return typeclz.getNameSync();
        });
        this.argTypes.push(argTypes);
    }
    getProp(name) {
        return undefined;
    }
    getJavaWarpper(argTypes) {
        if (argTypes === undefined)
            return this.methods[0];
        let midx = 0;
        for (const types of this.argTypes) {
            if (argTypes.length === types.length) {
                let hit = true;
                for (let i = 0; hit && i < types.length; ++i) {
                    if (argTypes[i] !== null && types[i] !== argTypes[i]) {
                        hit = false;
                        let argClass = loader.getClass(argTypes[i]);
                        for (const subType of argClass.getSubTypes()) {
                            if (subType === types[i]) {
                                hit = true;
                                break;
                            }
                        }
                    }
                }
                if (hit)
                    return this.methods[midx];
            }
            midx++;
        }
        return undefined;
    }
    getOverloadMethod(argTypes) {
        const method = this.getJavaWarpper(argTypes);
        if (method === undefined)
            return undefined;
        const aMethod = new JavaMethod(this.methodName);
        aMethod.addOverload(method);
        return aMethod;
    }
    getReturnType(argTypes) {
        const method = this.getJavaWarpper(argTypes);
        if (method === undefined)
            return undefined;
        if (method.getReturnTypeSync !== undefined) {
            return method.getReturnTypeSync().getNameSync();
        }
        // is constructor method
        return method.getNameSync();
    }
    getArgTypes(midx = 0) {
        return this.argTypes[midx];
    }
    getReturnClass(argTypes) {
        let className = this.getReturnType(argTypes);
        return className ? loader.getClass(className) : undefined;
    }
    getCompletionDetail(name) {
    }
    getCompletionEntries(originEntries) {
        if (this.cachedEntries !== undefined)
            return this.cachedEntries;
        if (this.methods.length === 0)
            return undefined;
        this.cachedEntries = [];
        const parentClassName = this.methods[0].getDeclaringClassSync().getNameSync();
        const fridaMethodWarpperProps = [
            "methodName",
            "implementation",
            "overloads",
            "argumentTypes",
            "returnType",
        ];
        fridaMethodWarpperProps.forEach(fieldName => {
            this.cachedEntries.push({
                sortText: fieldName,
                name: fieldName,
                source: "Java_m:" + parentClassName,
                kind: tslib.ScriptElementKind.memberVariableElement
            });
        });
        this.argTypes.forEach(argTypes => {
            let overloadArg = '';
            if (argTypes.length > 0) {
                argTypes.forEach(type => {
                    overloadArg += "'" + type + "', ";
                });
                overloadArg = overloadArg.slice(0, -2);
            }
            this.cachedEntries.push({
                sortText: "overload(",
                name: "overload(" + overloadArg + ")",
                source: "Java_m:" + parentClassName,
                kind: tslib.ScriptElementKind.memberVariableElement
            });
        });
        return this.cachedEntries;
    }
}
exports.JavaMethod = JavaMethod;
const fieldCompletionEntries = [{
        sortText: "value",
        name: "value",
        kind: tslib.ScriptElementKind.memberVariableElement
    }, {
        sortText: "fieldType",
        name: "fieldType",
        kind: tslib.ScriptElementKind.memberVariableElement
    }, {
        sortText: "fieldReturnType",
        name: "fieldReturnType",
        kind: tslib.ScriptElementKind.memberVariableElement
    }, {
        sortText: "holder",
        name: "holder",
        kind: tslib.ScriptElementKind.memberVariableElement
    },
];
class JavaField {
    constructor(field) {
        this.field = field;
        this.cachedEntries = undefined;
    }
    getJavaWarpper() {
        return this.field;
    }
    getCompletionDetail(name) {
        let symbol = {
            name: '',
            valueDeclaration: undefined,
            flags: 0,
            escapedName: undefined,
            declarations: [],
        };
        let d;
        switch (name) {
            case 'value':
                symbol.name = this.field.getTypeSync().getNameSync();
            case 'holder':
                symbol.name = this.field.getDeclaringClassSync().getNameSync();
            case 'fieldType':
            case 'fieldReturnType':
        }
        return symbol;
    }
    getTypeName() {
        return this.field.getTypeSync().getNameSync();
    }
    getProp(name) {
        if (name === 'value') {
            return loader.getClass(this.field.getTypeSync().getNameSync());
        }
        if (name === 'holder') {
            return loader.getClass(this.field.getDeclaringClassSync().getNameSync());
        }
        return undefined;
    }
    getCompletionEntries(originEntries) {
        if (this.cachedEntries === undefined) {
            this.cachedEntries = fieldCompletionEntries.map(entry => {
                entry.source = "Java_f:" + this.field.getDeclaringClassSync().getNameSync();
                return entry;
            });
        }
        return this.cachedEntries;
    }
}
exports.JavaField = JavaField;
