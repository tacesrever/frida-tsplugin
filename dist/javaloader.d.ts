import * as tslib from "typescript/lib/tsserverlibrary";
export declare class JavaLoader {
    classCache: Map<string, JavaClass>;
    constructor(classpaths: string[]);
    getClass(className: string): JavaClass;
}
export declare class JavaClass {
    className: string;
    klass: any;
    subTypes: string[];
    methods: Map<string, JavaMethod>;
    fields: Map<string, JavaField>;
    cachedEntries: tslib.CompletionEntry[];
    constructor(className: string);
    getTypeName(): string;
    getSubTypes(): string[];
    getProp(name: string): JavaMethod | JavaField;
    getField(fieldName: string): JavaField;
    getMethod(methodName: string): JavaMethod;
    getJavaWarpper(): any;
    getCompletionDetails(name: string): tslib.CompletionEntryDetails;
    getCompletionEntries(originEntries?: tslib.CompletionEntry[]): tslib.CompletionEntry[];
}
export declare class JavaMethod {
    methodName: string;
    methods: any[];
    argTypes: string[][];
    cachedEntries: tslib.CompletionEntry[];
    constructor(methodName: string);
    getTypeName(): string;
    getOverloadCount(): number;
    addOverload(method: any): void;
    getProp(name: string): any;
    getJavaWarpper(argTypes?: string[]): any;
    getOverloadMethod(argTypes?: string[]): JavaMethod;
    getReturnType(argTypes?: string[]): string;
    getArgTypes(midx?: number): string[];
    getReturnClass(argTypes?: string[]): JavaClass;
    getCompletionDetail(name: string): void;
    getCompletionEntries(originEntries?: tslib.CompletionEntry[]): tslib.CompletionEntry[];
}
export declare class JavaField {
    private field;
    cachedEntries: tslib.CompletionEntry[];
    constructor(field: any);
    getJavaWarpper(): any;
    getCompletionDetail(name: string): {
        name: string;
        valueDeclaration: any;
        flags: number;
        escapedName: any;
        declarations: any[];
    };
    getTypeName(): any;
    getProp(name: string): JavaClass;
    getCompletionEntries(originEntries?: tslib.CompletionEntry[]): tslib.CompletionEntry[];
}
