--- @type NvPluginSpec
local M = {
	"mg979/vim-visual-multi",
	event = { "BufReadPre", "BufNewFile" },
	config = function()
		vim.g.VM_maps = {
			["Add Cursor Up"] = "<C-k>",
			["Add Cursor Down"] = "<C-j>",
		}
	end,
}

return M
