local cmd = vim.api.nvim_create_user_command

-- close all buffers and exit
cmd("Q", function()
  vim.cmd "qa"
end, {
  desc = "Close all buffers and exit",
})
