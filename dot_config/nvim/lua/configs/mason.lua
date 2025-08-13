return {
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
