vim.g.mapleader = " "

local map = vim.keymap.set

map("n", ";", ":", { desc = "cmd enter command mode" })
map("n", "_", ":", { desc = "cmd enter command mode" })

map("n", "<leader>w", "<cmd>w<CR>", { desc = "save file" })
map("v", "<leader>w", "<cmd>w<CR>", { desc = "save file" })

map("i", "<C-b>", "<esc>^i", { desc = "move beginning of line" })
map("i", "<C-e>", "<End>", { desc = "move end of line" })

map("n", "<Esc>", "<cmd>noh<CR>", { desc = "general clear highlights" })

map("n", "<C-s>", "<cmd>w<CR>", { desc = "general save file" })
map("n", "<C-c>", "<cmd>%y+<CR>", { desc = "general copy whole file" })

map("n", "<leader>n", "<cmd>set nu!<CR>", { desc = "toggle line number" })
map("n", "<leader>rn", "<cmd>set rnu!<CR>", { desc = "toggle relative number" })
map("n", "<leader>ch", "<cmd>NvCheatsheet<CR>", { desc = "toggle nvcheatsheet" })

map("n", "<leader>fm", function()
  require("conform").format { lsp_fallback = true }
end, { desc = "general format file" })

map("v", "K", ":m '<-2<CR>gv=gv", { silent = true, desc = "move selected lines up" })
map("v", "J", ":m '>+1<CR>gv=gv", { silent = true, desc = "move selected lines down" })

map({ "n", "x" }, "H", "^", { desc = "Go to first non-blank" })
map({ "n", "x" }, "L", "g_", { desc = "Go to last non-blank" })

-- Surround mappings
map("x", '"', [[c"<C-r>""<Esc>]], { noremap = true, silent = true, desc = "wrap selected text in double quotes" })
map("x", "'", [[c'<C-r>"'<Esc>]], { noremap = true, silent = true, desc = "wrap selected text in single quotes" })
map("x", "(", [[c(<C-r>")<Esc>]], { noremap = true, silent = true, desc = "wrap selected text in parentheses" })
map("x", "[", [[c[<C-r>"]<Esc>]], { noremap = true, silent = true, desc = "wrap selected text in square brackets" })
map("x", "{", [[c{<C-r>"}<Esc>]], { noremap = true, silent = true, desc = "wrap selected text in curly braces" })

map("n", "J", "mzJ`z", { desc = "join lines and keep cursor position" })
map("n", "<C-d>", "<C-d>zz", { desc = "scroll down and keep cursor position" })
map("n", "<C-u>", "<C-u>zz", { desc = "scroll up and keep cursor position" })
map("n", "n", "nzzzv")
map("n", "N", "Nzzzv")

map("x", "p", [["_dP]], { noremap = true, silent = true })

-- Find and replace mappings
map("n", "<leader>s", [[:%s/\<<C-r><C-w>\>/<C-r><C-w>/gI<Left><Left><Left>]])
map("x", "<leader>s", function()
  vim.cmd 'normal! "vy'
  local text = vim.fn.getreg("v"):gsub("\n", "")
  local escaped = vim.fn.escape(text, [[\/]])

  local cmd = ":%s/" .. escaped .. "/" .. escaped .. "/gI"
  local left3 = vim.api.nvim_replace_termcodes("<Left><Left><Left>", true, false, true)

  vim.api.nvim_feedkeys(cmd .. left3, "n", false)
end, { desc = "Find & replace highlighted text" })
map("x", "<leader>S", [[:s/]], { noremap = true, silent = false })

map("v", "//", function()
  vim.cmd 'normal! "vy'

  local text = vim.fn.getreg "v"

  text = text:gsub("\n", "")

  local escaped = vim.fn.escape(text, [[\/.*$^~[]])
  local cmd_string = "/" .. escaped

  local feed_string = vim.api.nvim_replace_termcodes(cmd_string, true, false, true)
  vim.api.nvim_feedkeys(feed_string, "n", false)
end, { desc = "search highlighted text" })

-- global ls>+1<CR>gv=gvp mappings
map("n", "<leader>ds", vim.diagnostic.setloclist, { desc = "LSP diagnostic loclist" })
map("n", "<leader>lf", vim.diagnostic.open_float, { desc = "Open diagnostic float" })
map("n", "<leader>lp", vim.diagnostic.goto_prev, { desc = "Go to previous diagnostic" })
map("n", "<leader>ln", vim.diagnostic.goto_next, { desc = "Go to next diagnostic" })

-- tabufline
map("n", "<leader>b", "<cmd>new<CR>", { desc = "buffer new" })

-- Comment
map("n", "<leader>/", "gcc", { desc = "toggle comment", remap = true })
map("v", "<leader>/", "gc", { desc = "toggle comment", remap = true })

-- whichkey
map("n", "<leader>K", "<cmd>WhichKey <CR>", { desc = "whichkey all keymaps" })
