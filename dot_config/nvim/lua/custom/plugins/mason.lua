local overrides = require "custom.configs.overrides"
---@type NvPluginSpec
local M = {
  "williamboman/mason.nvim",
  opts = overrides.mason,
}

return M
