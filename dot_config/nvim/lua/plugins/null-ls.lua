return {
  "nvimtools/none-ls.nvim",
  event = "User FilePost",
  opts = function()
    local builtins = require "null-ls.builtins"

    local opts = {
      sources = {
        builtins.code_actions.refactoring,
        builtins.diagnostics.semgrep,

        -- terraform
        builtins.diagnostics.terraform_validate,
        builtins.diagnostics.tfsec,
        builtins.formatting.terraform_fmt,

        -- yaml
        builtins.diagnostics.yamllint,
      },
    }

    return opts
  end,
}
