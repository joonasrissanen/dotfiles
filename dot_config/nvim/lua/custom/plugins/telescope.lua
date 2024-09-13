local overrides = require("custom.configs.overrides")
---@type NvPluginSpec
local M = {
	"nvim-telescope/telescope.nvim",
	dependencies = { "nvim-treesitter/nvim-treesitter" },
	opts = overrides.telescope,
	cmd = "Telescope",
	init = function()
		require("core.utils").load_mappings("telescope")
	end,
	config = function(_, opts)
		dofile(vim.g.base46_cache .. "telescope")
		local telescope = require("telescope")
		telescope.setup(opts)

		-- load extensions
		for _, ext in ipairs(opts.extensions_list) do
			telescope.load_extension(ext)
		end
	end,
}

return M
