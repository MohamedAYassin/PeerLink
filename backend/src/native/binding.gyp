{
  "targets": [
    {
      "target_name": "net_io",
      "sources": [ "net_io.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "cflags": [ "-O3", "-march=native" ],
      "cflags_cc": [ "-O3", "-march=native", "-std=c++17" ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ["OS=='linux'", {
          "cflags": [ "-mavx2" ],
          "cflags_cc": [ "-mavx2" ]
        }],
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "OTHER_CFLAGS": [ "-mavx2", "-O3", "-march=native" ]
          }
        }],
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "EnableEnhancedInstructionSet": "3",
              "Optimization": "3"
            }
          }
        }]
      ]
    }
  ]
}
