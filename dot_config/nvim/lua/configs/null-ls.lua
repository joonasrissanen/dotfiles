local builtins = require "null-ls.builtins"

local opts = {
  sources = {
    builtins.code_actions.refactoring,
    builtins.diagnostics.semgrep,

    -- Go
    builtins.formatting.gofmt,
    builtins.formatting.goimports,
    builtins.formatting.golines,
    builtins.formatting.gofumpt,
    builtins.diagnostics.golangci_lint,

    -- terraform
    builtins.diagnostics.terraform_validate,
    builtins.diagnostics.tfsec,
    builtins.formatting.terraform_fmt,

    -- yaml
    builtins.diagnostics.yamllint,
  },
}

return opts
