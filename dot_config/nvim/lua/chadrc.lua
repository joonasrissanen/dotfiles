-- This file needs to have same structure as nvconfig.lua
-- https://github.com/NvChad/ui/blob/v3.0/lua/nvconfig.lua
-- Please read that file to know all available options :(

---@type ChadrcConfig
local M = {}

M.base46 = {
  theme = "catppuccin",
  theme_toggle = { "catppuccin", "github_light" },
  transparency = false,
}

M.ui = {
  statusline = {
    enabled = true,
    theme = "vscode_colored",
    separator_style = "arrow",
  },

  cmp = {
    lspkind_text = true,
    style = "atom_colored",
    format_colors = {
      tailwind = false,
    },
  },
}

return M
