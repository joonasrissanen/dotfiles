-- Language Server Protocol (LSP) setup
-- with nvim-lspconfig and null-ls.nvim

---@type NvPluginSpec
local M = {
  "neovim/nvim-lspconfig",
  config = function()
    require "plugins.configs.lspconfig"
    require "custom.configs.lspconfig"
  end, -- Override to setup mason-lspconfig
}

return M
