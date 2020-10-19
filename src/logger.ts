import * as fs from 'fs';

let logfile: string = null;
export function log(...msg: {toString: () => string}[]) {
    if(logfile === null) return;
    fs.appendFileSync(logfile, msg.map(s => {
        if(s === undefined) return 'undefined';
        if(s === null) return 'null';
        return s.toString();
    }).join(' ') + "\n");
}

export function setLogfile(filename: string) {
    logfile = filename;
    fs.writeFileSync(logfile, "");
}