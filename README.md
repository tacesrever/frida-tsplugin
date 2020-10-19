
# typescript plugin  
AutoComplete plugin for frida's java warpper.  

![](./example.png)

# Useage  
compile agent/tsplugin.ts by frida-compile, and load it in target app;  
and here is a compiled script file at agent/tsplugin.js (target v8).  

add plugin config in tsconfig.json after clone frida-agent-example:  
  
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