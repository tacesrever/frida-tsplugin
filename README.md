
# frida-tsplugin  
AutoComplete plugin for frida's java warpper.  

![](./example.png)

# Usage  
## install  
```
$ git clone https://github.com/tacesrever/frida-tsplugin.git
$ cd frida-tsplugin
$ npm install
```
## load  
with frida ^14.0.0:
```
$ frida -U -l agent/tsplugin.js target  
$ adb forward tcp:28042 tcp:28042  
```
or you can edit the port in agent/tsplugin.ts and compile it by frida-compile.  

add plugin in `frida-agent-example/tsconfig.json` after setup [frida-agent-example](https://github.com/oleavr/frida-agent-example):  

```
{
    "compilerOptions": {
        ...
        ,
        "plugins": [{
            "name": path to tsplugin,
            "host"?: ip of target device, default is "127.0.0.1"(use adb forward tcp:port tcp:port)
            "port"?: listen port in tsplugin.ts, default is 28042
            "logfile"?: path to logfile
        }]
    }
}
```
## debug  

if nothing happen after load, you can:  
- Ensure plugin is loaded  
> set logfile path mentioned above, if the logfile didn't created, the plugin may fail to load.  
> press F1, type 'Ty' then click Typescript: Open TS Server log, find 'frida-tsplugin' to see if plguin load sucessed.  
> 
- Ensure frida-tsplugin's typescript version same as vscode's.  
> check typescript version in vscode's install dir `Microsoft VS Code( Insiders)/resources/app/extensions/node_modules/typescript/package.json` and in frida-tsplugin/package.json's dependencies, if not same, you should run `npm i typescript@version from vscode` then `tsc -p .` under frida-tsplugin.  
- Ensure agent service is on  
> open http://127.0.0.1:28042/getJavaClassInfo?className=java.lang.String to see if any content.  