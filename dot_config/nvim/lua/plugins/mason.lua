return {
  "williamboman/mason.nvim",
  cmd = { "Mason", "MasonInstall", "MasonInstallAll", "MasonUpdate" },
  lazy = false,
  config = function(opts)
    require("mason").setup(opts)
  end,
  opts = function()
    local opts = {
      PATH = "prepend",
      ensure_installed = {
        -- lua stuff
        "lua-language-server",
        "stylua",

        -- web dev stuff
        "typescript-language-server",
        "css-lsp",
        "html-lsp",
        "deno",
        "prettierd",
        "prettier",

        -- c/cpp stuff
        "clangd",
        "clang-format",

        -- shell stuff
        "shfmt",
        -- python
        "pyright",
        "ruff",
        "black",
        "mypy",
        "terraform-ls",

        -- go
        "gopls",
        "goimports",
        "golines",
        -- sql
        "sqlfluff",
      },
    }

    vim.api.nvim_create_user_command("MasonInstallAll", function()
      vim.cmd("MasonInstall " .. table.concat(opts.ensure_installed, " "))
    end, {})
    return opts
  end,
}
