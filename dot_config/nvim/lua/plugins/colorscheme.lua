return {
  {
    "rose-pine/neovim",
    name = "rose-pine",
    lazy = "false",
    config = function()
      require("rose-pine").setup {
        variant = "auto",
        dark_variant = "moon",
        disable_background = true,
        styles = {
          italic = false,
          transparency = false,
        },
      }
      vim.cmd.colorscheme "rose-pine"
      local groups = {
        "Normal",
        -- "NeoTreeNormal",
        -- "NeoTreeNormalNC",
        -- "BufferLineFill",
        -- "DiagnosticError",
        -- "Float",
        -- "NvimFloat",
        -- "DiagnosticFloatingError",
        -- "CocDiagnosticError",
        "NormalFloat",
      }
      -- trying to make the popup opaque
      for _, group in ipairs(groups) do
        vim.api.nvim_set_hl(0, group, { bg = nil, ctermbg = nil })
      end
    end,
  },
}
