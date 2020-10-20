"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLogfile = exports.log = void 0;
const fs = require("fs");
let logfile = null;
function log(...msg) {
    if (logfile === null)
        return;
    fs.appendFileSync(logfile, msg.map(s => {
        if (s === undefined)
            return 'undefined';
        if (s === null)
            return 'null';
        return s.toString();
    }).join(' ') + "\n");
}
exports.log = log;
function setLogfile(filename) {
    logfile = filename;
    fs.writeFileSync(logfile, "");
}
exports.setLogfile = setLogfile;
