"use strict";
const tslib = require("typescript/lib/tsserverlibrary");
const infoprovider_1 = require("./infoprovider");
const logger_1 = require("./logger");
function init(mod) {
    const typescript = mod.typescript;
    function create(info) {
        const tsLS = info.languageService;
        if (info.config.logfile !== undefined)
            logger_1.setLogfile(info.config.logfile);
        const proxy = Object.create(null);
        for (let k of Object.keys(info.languageService)) {
            const x = info.languageService[k];
            proxy[k] = (...args) => x.apply(info.languageService, args);
        }
        const javaLoader = new infoprovider_1.JavaProviderLoader(info.config);
        proxy.getCompletionsAtPosition = (fileName, position, options) => {
            const source = getSourceFile(fileName);
            let oret = tsLS.getCompletionsAtPosition(fileName, position, options);
            try {
                const completeFor = getNodeAtPosition(source, position).parent.getChildAt(0);
                logger_1.log("trigger:", options.triggerCharacter, 'completeFor ' + completeFor.getText());
                const provider = findInfoProviderForExpr(source, completeFor);
                if (provider === undefined)
                    return oret;
                const entries = provider.getCompletionEntries(oret ? oret.entries : undefined);
                if (entries === undefined)
                    return oret;
                if (oret === undefined) {
                    oret = {
                        entries: entries,
                        isGlobalCompletion: false,
                        isMemberCompletion: true,
                        isNewIdentifierLocation: false
                    };
                }
                else {
                    oret.entries = entries;
                }
            }
            catch (e) {
                logger_1.log(e.stack);
            }
            return oret;
        };
        proxy.getCompletionEntryDetails = (fileName, position, name, options, source, pref) => {
            logger_1.log("getCompletionEntryDetails", name, source);
            if (source && source.indexOf("Java_") === 0) {
                let [type, className] = source.substr(5).split(':');
                if (type === 'c') {
                    const provider = javaLoader.getProviderByName(className);
                    const details = provider.getCompletionDetail(name);
                    if (details !== undefined)
                        return details;
                }
                else {
                    const divpos = className.lastIndexOf('.');
                    const propName = className.substr(divpos + 1);
                    className = className.substr(0, divpos);
                    const provider = javaLoader.getProviderByName(className);
                    const propProvider = provider.getPropInfoProvider(propName);
                    const details = propProvider.getCompletionDetail(name);
                    if (details !== undefined)
                        return details;
                }
            }
            return tsLS.getCompletionEntryDetails(fileName, position, name, options, source, pref);
        };
        proxy.getQuickInfoAtPosition = (fileName, position) => {
            const info = tsLS.getQuickInfoAtPosition(fileName, position);
            const source = getSourceFile(fileName);
            try {
                let getInfoFor = getNodeAtPosition(source, position);
                if (getInfoFor.parent.kind === tslib.SyntaxKind.PropertyAccessExpression
                    && getInfoFor.parent.getChildAt(0) !== getInfoFor) {
                    getInfoFor = getInfoFor.parent;
                }
                const provider = findInfoProviderForExpr(source, getInfoFor);
                if (provider === undefined)
                    return info;
                // get info for overload function
                if (getInfoFor.parent.kind === tslib.SyntaxKind.CallExpression
                    && getInfoFor.parent.getChildAt(0) === getInfoFor) {
                    const callExpr = getInfoFor.parent;
                    const argTypes = findArgTypesForCallExpr(source, callExpr);
                    if (argTypes === undefined)
                        return info;
                    info.displayParts = [{
                            text: provider.getDeclare(argTypes),
                            kind: 'text'
                        }];
                    return info;
                }
                info.displayParts = [{
                        text: provider.getDeclare(),
                        kind: 'text'
                    }];
            }
            catch (e) {
                logger_1.log(e.stack);
            }
            return info;
        };
        function getSourceFile(fileName) {
            return tsLS.getNonBoundSourceFile(fileName);
        }
        function getNodeAtPosition(source, position) {
            let current = source;
            outer: while (true) {
                for (const child of current.getChildren(source)) {
                    const start = child.getFullStart();
                    if (start > position) {
                        return current;
                    }
                    const end = child.getEnd();
                    if (position <= end) {
                        current = child;
                        continue outer;
                    }
                }
                return current;
            }
        }
        function findInfoProviderForExpr(source, node) {
            let current = node;
            while (true) {
                switch (current.kind) {
                    case tslib.SyntaxKind.CallExpression:
                        return findReturnInfoProviderForCallExpr(source, current);
                    case tslib.SyntaxKind.Identifier:
                        let writeRef = findLastWriteRef(source.fileName, current.getStart());
                        let typeName = writeRef.definition.name.split(':')[1];
                        if (typeName !== undefined) {
                            typeName = typeName.trim();
                            if (typeName !== 'any' && typeName.indexOf('Java.Wrapper') !== 0) {
                                logger_1.log("type missmatch:", typeName);
                                return undefined;
                            }
                        }
                        let writeExpr = getNodeAtPosition(source, writeRef.reference.textSpan.start + 1).parent;
                        if (writeRef.definition.kind === tslib.ScriptElementKind.parameterElement) {
                            current = writeExpr;
                            break;
                        }
                        while (writeExpr.kind === tslib.SyntaxKind.PropertyAccessExpression)
                            writeExpr = writeExpr.parent;
                        if (![
                            tslib.SyntaxKind.BinaryExpression,
                            tslib.SyntaxKind.PropertyAssignment,
                            tslib.SyntaxKind.VariableDeclaration,
                        ].includes(writeExpr.kind)) {
                            return undefined;
                        }
                        current = writeExpr.getChildAt(2);
                        break;
                    case tslib.SyntaxKind.ElementAccessExpression:
                    case tslib.SyntaxKind.PropertyAccessExpression:
                        let parentNode = current.getChildAt(0);
                        let propNode = current.getChildAt(2);
                        let propWriteRef = undefined;
                        let propName = propNode.getText();
                        if (!["value", "$new", "$init", "overload"].includes(propName))
                            propWriteRef = findLastWriteRef(source.fileName, propNode.getEnd());
                        if (propWriteRef === undefined) {
                            let provider = findInfoProviderForExpr(source, parentNode);
                            if (provider === undefined) {
                                return undefined;
                            }
                            return provider.getPropInfoProvider(propNode.getText());
                        }
                        let tmpExpr = getNodeAtPosition(source, propWriteRef.reference.textSpan.start).parent;
                        if (tmpExpr.kind === tslib.SyntaxKind.PropertyAssignment) {
                            current = tmpExpr.getChildAt(2);
                            break;
                        }
                        while (tmpExpr.kind === tslib.SyntaxKind.PropertyAccessExpression)
                            tmpExpr = tmpExpr.parent;
                        if (tmpExpr.kind === tslib.SyntaxKind.BinaryExpression) {
                            current = tmpExpr.getChildAt(2);
                            break;
                        }
                        return undefined;
                    // parse this and params from:
                    // func.impl = (...args)
                    // TODO: Java.choose => onMatch: function (instance)
                    case tslib.SyntaxKind.ThisKeyword:
                    case tslib.SyntaxKind.Parameter:
                        let target = current;
                        while (![tslib.SyntaxKind.FunctionExpression,
                            tslib.SyntaxKind.FunctionDeclaration,
                            tslib.SyntaxKind.ArrowFunction]
                            .includes(current.kind))
                            current = current.parent;
                        let funcDefExpr = current;
                        let funcAssignExpr;
                        if (funcDefExpr.name !== undefined) {
                            // TODO: for named function, find use of it
                            return undefined;
                        }
                        else {
                            funcAssignExpr = funcDefExpr.parent;
                        }
                        if (![
                            tslib.SyntaxKind.BinaryExpression,
                            tslib.SyntaxKind.PropertyAssignment,
                        ].includes(funcAssignExpr.kind))
                            return undefined;
                        const leftValue = funcAssignExpr.getChildAt(0);
                        if (leftValue.kind === tslib.SyntaxKind.PropertyAccessExpression
                            && leftValue.getChildAt(2).getText() === 'implementation') {
                            let methodNode = leftValue.getChildAt(0);
                            if (target.kind === tslib.SyntaxKind.ThisKeyword) {
                                if (methodNode.kind === tslib.SyntaxKind.CallExpression &&
                                    methodNode.getChildAt(0).getChildAt(2).getText() === 'overload') {
                                    methodNode = methodNode.getChildAt(0).getChildAt(0);
                                }
                                let classNode = methodNode.getChildAt(0);
                                return findInfoProviderForExpr(source, classNode);
                            }
                            // is parameter
                            let i;
                            for (i = 0; i < funcDefExpr.parameters.length; ++i) {
                                if (funcDefExpr.parameters[i] === target) {
                                    break;
                                }
                            }
                            if (methodNode.kind === tslib.SyntaxKind.CallExpression
                                && methodNode.getChildAt(0).getChildAt(2).getText() === 'overload') {
                                const argTypeNameNode = methodNode.arguments[i];
                                const argTypeName = findStringLiteral(source, argTypeNameNode);
                                if (argTypeName === undefined)
                                    return undefined;
                                return javaLoader.getProviderByName(argTypeName);
                            }
                            const method = findInfoProviderForExpr(source, methodNode);
                            if (method === undefined)
                                return undefined;
                            return javaLoader.getProviderByName(method.getParamClassNames()[i]);
                        }
                    default:
                        return undefined;
                }
            }
        }
        function findReturnInfoProviderForCallExpr(source, callExpr) {
            let funcExpr = callExpr.expression;
            if (funcExpr.kind === tslib.SyntaxKind.PropertyAccessExpression) {
                let funcPropAccExpr = funcExpr;
                let funcName = funcPropAccExpr.name.text;
                if (funcPropAccExpr.expression.getText() === "Java") {
                    if (funcName === 'use') {
                        return javaLoader.getProviderByName(findStringLiteral(source, callExpr.arguments[0]));
                    }
                    if (funcName === 'cast') {
                        let classNode = callExpr.arguments[1];
                        if (classNode === undefined)
                            return undefined;
                        return findInfoProviderForExpr(source, classNode);
                    }
                    return undefined;
                }
                let parent = findInfoProviderForExpr(source, funcPropAccExpr.expression);
                if (parent === undefined)
                    return undefined;
                if (funcName === 'call') {
                    let method = parent;
                    let argTypes = findArgTypesForCallExpr(source, callExpr);
                    if (argTypes === undefined)
                        return undefined;
                    argTypes = argTypes.slice(1);
                    return method.getOverloadInfoProvider(argTypes).getReturnInfoProvider();
                }
                else if (funcName === 'apply') {
                    let method = parent;
                    // TODO: detact apply argTypes
                    return method.getReturnInfoProvider();
                }
                else if (funcName === 'overload') {
                    let method = parent;
                    let argTypes = callExpr.arguments.map(expr => findStringLiteral(source, expr));
                    if (argTypes === undefined)
                        return undefined;
                    return method.getOverloadInfoProvider(argTypes);
                }
                else {
                    let klass = parent;
                    let method = klass.getMethodInfoProvider(funcName);
                    if (!method.hasOverload())
                        return method.getReturnInfoProvider();
                    let argTypes = findArgTypesForCallExpr(source, callExpr);
                    if (argTypes === undefined)
                        return undefined;
                    return method.getReturnInfoProvider(argTypes);
                }
            }
            let method = findInfoProviderForExpr(source, funcExpr);
            if (method === undefined)
                return undefined;
            return method.getReturnInfoProvider();
        }
        function findArgTypesForCallExpr(source, callExpr) {
            let argTypes = [];
            for (let i = 0; i < callExpr.arguments.length; ++i) {
                let arg = callExpr.arguments[i];
                let typeName = findTargetTypeForCommonType(source, arg);
                if (typeName === undefined) {
                    let type = findInfoProviderForExpr(source, arg);
                    if (type === undefined)
                        return undefined;
                    typeName = type.getClassName();
                }
                argTypes.push(typeName);
            }
            return argTypes;
        }
        function findTargetTypeForCommonType(source, node) {
            switch (node.kind) {
                case tslib.SyntaxKind.NumericLiteral:
                    return 'int';
                case tslib.SyntaxKind.TrueKeyword:
                case tslib.SyntaxKind.FalseKeyword:
                    return 'boolean';
                case tslib.SyntaxKind.NullKeyword:
                case tslib.SyntaxKind.UndefinedKeyword:
                    return null;
                case tslib.SyntaxKind.StringLiteral:
                    return 'java.lang.String';
                case tslib.SyntaxKind.Identifier:
                    let writeRef = findLastWriteRef(source.fileName, node.getStart());
                    if (writeRef === undefined)
                        return undefined;
                    let typeName = writeRef.definition.name.split(':')[1];
                    if (typeName !== undefined) {
                        typeName = typeName.trim();
                        switch (typeName) {
                            case 'number':
                                return 'int';
                            case 'boolean':
                                return 'boolean';
                            case 'string':
                                return 'java.lang.String';
                            default:
                                break;
                        }
                    }
                    let writeExpr = getNodeAtPosition(source, writeRef.reference.textSpan.start + 1).parent;
                    while (writeExpr.kind === tslib.SyntaxKind.PropertyAccessExpression)
                        writeExpr = writeExpr.parent;
                    if (![
                        tslib.SyntaxKind.BinaryExpression,
                        tslib.SyntaxKind.PropertyAssignment,
                        tslib.SyntaxKind.VariableDeclaration,
                    ].includes(writeExpr.kind))
                        return undefined;
                    if (typeName !== undefined && typeName.indexOf('Java.Wrapper') === 0)
                        return findInfoProviderForExpr(source, writeExpr.getChildAt(2)).getClassName();
                    return findTargetTypeForCommonType(source, writeExpr.getChildAt(2));
                default:
                    return undefined;
            }
        }
        function findLastWriteRef(fileName, position) {
            const refinfos = tsLS.findReferences(fileName, position);
            if (refinfos === undefined)
                return undefined;
            let reference = null;
            let definition = null;
            for (const refinfo of refinfos) {
                for (const ref of refinfo.references) {
                    if (ref.isWriteAccess) {
                        if (reference === null) {
                            reference = ref;
                            definition = refinfo.definition;
                            continue;
                        }
                        if (ref.fileName === fileName) {
                            if (reference.fileName !== ref.fileName) {
                                reference = ref;
                                definition = refinfo.definition;
                            }
                            else if (ref.textSpan.start > reference.textSpan.start) {
                                reference = ref;
                                definition = refinfo.definition;
                            }
                        }
                    }
                }
            }
            return { reference, definition };
        }
        function findFirstUseRef(fileName, position) {
            const refinfos = tsLS.findReferences(fileName, position);
            if (refinfos === undefined)
                return undefined;
            for (const refinfo of refinfos) {
                for (const ref of refinfo.references) {
                    if (ref.isWriteAccess !== true) {
                        return { reference: ref, definition: refinfo.definition };
                    }
                }
            }
            return undefined;
        }
        function findStringLiteral(source, node) {
            let current = node;
            while (true) {
                switch (current.kind) {
                    case tslib.SyntaxKind.StringLiteral:
                        return current.text;
                    case tslib.SyntaxKind.Identifier:
                        const writeRef = findLastWriteRef(source.fileName, current.getStart());
                        let writeExpr = getNodeAtPosition(source, writeRef.reference.textSpan.start + 1).parent;
                        while (writeExpr.kind === tslib.SyntaxKind.PropertyAccessExpression)
                            writeExpr = writeExpr.parent;
                        if (![
                            tslib.SyntaxKind.BinaryExpression,
                            tslib.SyntaxKind.PropertyAssignment,
                            tslib.SyntaxKind.VariableDeclaration,
                        ].includes(writeExpr.kind))
                            return undefined;
                        current = writeExpr.getChildAt(2);
                        break;
                    default:
                        return undefined;
                }
            }
        }
        logger_1.log("plugin loaded");
        return proxy;
    }
    return { create };
}
module.exports = init;
