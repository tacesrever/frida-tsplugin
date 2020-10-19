
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
                "name": path_to_tsplugin,
                "logfile"?: path_to_logfile
            }]
        }
    }