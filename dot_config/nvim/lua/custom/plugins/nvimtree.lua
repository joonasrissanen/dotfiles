local overrides = require "custom.configs.overrides"
---@type NvPluginSpec
local M = {
  "nvim-tree/nvim-tree.lua",
  opts = overrides.nvimtree,
}

return M
