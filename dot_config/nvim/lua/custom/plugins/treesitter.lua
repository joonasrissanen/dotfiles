local overrides = require "custom.configs.overrides"
---@type NvPluginSpec
local M = {
  "nvim-treesitter/nvim-treesitter",
  opts = overrides.treesitter,
}

return M
