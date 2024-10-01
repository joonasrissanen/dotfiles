local M = {
  "windwp/nvim-ts-autotag",
  ft = {"javascript", "javascriptreact", "typescript", "typescriptreact"},
  config = function()
    require("nvim-ts-autotag").setup()
  end,
}

return M
