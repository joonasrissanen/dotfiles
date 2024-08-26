---@type MappingsTable
local M = {}

M.disabled = {
	n = {
		-- disable default nvimtree toggle
		-- as it collides with visual-multi
		["<C-n>"] = "",
	},
}

M.general = {
	n = {
		[";"] = { ":", "enter command mode", opts = { nowait = true } },
		["<C-t>"] = { "<cmd>NvimTreeToggle<cr>", "toggle nvimtree" },
		["qq"] = { "<ESC>", "Escape key", opts = { nowait = true, silent = true } },

		--  format with conform
		["<leader>fm"] = {
			function()
				require("conform").format()
			end,
			"formatting",
		},
	},
	v = {
		[">"] = { ">gv", "indent" },
		["qq"] = { "<ESC>", "Escape key", opts = { nowait = true, silent = true } },
	},
	i = {
		["qq"] = { "<ESC>", "Escape key", opts = { nowait = true, silent = true } },
	},
}

-- more keybinds!

return M
