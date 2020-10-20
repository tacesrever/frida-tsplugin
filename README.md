
# typescript plugin  
AutoComplete plugin for frida's java warpper.  

![](./example.png)

# Useage  
* after clone, run  
```
npm install
npm run compile
```
* compile agent/tsplugin.ts by frida-compile, and load it in target app;  
or here is a compiled script file at agent/tsplugin.js (target v8),  
you can load it by `frida -U --runtime=v8 -l tsplugin.js targetName`  
then run `adb forward tcp:28042 tcp:28042`.  

* add plugin config in tsconfig.json after clone frida-agent-example:  
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