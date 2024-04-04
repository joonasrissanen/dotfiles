local autocmd = vim.api.nvim_create_autocmd
require("custom.configs.cmds")
-- Auto resize panes when resizing nvim window
-- autocmd("VimResized", {
--   pattern = "*",
--   command = "tabdo wincmd =",
-- })

-- apply dotenv changes automatically on save
autocmd("BufWritePost", {
	pattern = vim.fn.expand("~") .. "/.local/share/chezmoi/*",
	command = 'silent ! chezmoi apply --source-path "%"',
})
