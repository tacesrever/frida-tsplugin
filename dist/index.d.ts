import * as tslib from 'typescript/lib/tsserverlibrary';
declare function init(mod: {
    typescript: typeof tslib;
}): {
    create: (info: tslib.server.PluginCreateInfo) => tslib.LanguageService;
};
export = init;
