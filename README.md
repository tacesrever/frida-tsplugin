
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
```
$ frida -U --runtime=v8 -l agent/tsplugin.js target  
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

