import * as tslib from "typescript/lib/tsserverlibrary";
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
    returnType: string;
    argumentTypes: string[];
}
declare interface JavaClassInfo {
    alltypes: string[];
    fields: {
        [index: string]: string;
    };
    methods: {
        [index: string]: JavaMethodInfo[];
    };
    wrapperProps: string[];
}
export declare class JavaProviderLoader {
    private config;
    classCache: Map<string, JavaClassInfoProvider>;
    baseurl: string;
    constructor(config: any);
    getProviderByName(className: string): JavaClassInfoProvider;
}
export declare class ObjCProviderLoader {
    constructor();
}
export declare class JavaClassInfoProvider implements ClassInfoProvider {
    classInfo: JavaClassInfo;
    methods: Map<string, JavaMethodInfoProvider>;
    fields: Map<string, JavaFieldInfoProvider>;
    cachedEntries: tslib.CompletionEntry[];
    constructor(classInfo: JavaClassInfo);
    getClassName(): string;
    getExtendClassNames(): string[];
    getPropInfoProvider(name: string): JavaMethodInfoProvider | JavaFieldInfoProvider;
    getFieldInfoProvider(fieldName: string): JavaFieldInfoProvider;
    getMethodInfoProvider(methodName: string): JavaMethodInfoProvider;
    getDeclare(): string;
    getCompletionDetail(name: string): tslib.CompletionEntryDetails;
    getCompletionEntries(originEntries?: tslib.CompletionEntry[]): tslib.CompletionEntry[];
}
export declare class JavaMethodInfoProvider implements MethodInfoProvider {
    className: string;
    name: string;
    methodInfo: JavaMethodInfo[];
    cachedEntries: tslib.CompletionEntry[];
    constructor(className: string, name: string, methodInfo: JavaMethodInfo[]);
    getClassName(): string;
    hasOverload(): boolean;
    getPropInfoProvider(name: string): any;
    getMethodInfo(argTypes?: string[]): JavaMethodInfo;
    getOverloadInfoProvider(argTypes?: string[]): JavaMethodInfoProvider;
    getReturnClassName(argTypes?: string[]): string;
    getDeclare(argTypes?: string[]): string;
    getParamClassNames(): string[];
    getReturnInfoProvider(argTypes?: string[]): JavaClassInfoProvider;
    getCompletionDetail(name: string): tslib.CompletionEntryDetails;
    getCompletionEntries(originEntries?: tslib.CompletionEntry[]): tslib.CompletionEntry[];
}
export declare class JavaFieldInfoProvider implements FieldInfoProvider {
    className: string;
    name: string;
    type: string;
    cachedEntries: tslib.CompletionEntry[];
    constructor(className: string, name: string, type: string);
    getDeclare(): string;
    getClassName(): string;
    getPropInfoProvider(name: string): JavaClassInfoProvider;
    getCompletionDetail(name: string): tslib.CompletionEntryDetails;
    getCompletionEntries(originEntries?: tslib.CompletionEntry[]): tslib.CompletionEntry[];
}
export {};
