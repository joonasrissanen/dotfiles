---@type NvPluginSpec
local M = {
	"stevearc/conform.nvim",
	event = { "BufReadPre", "BufNewFile" },
	dependencies = {
		"aquasecurity/vim-tfsec",
	},
	config = function()
		local conform = require("conform")

		conform.setup({
			formatters_by_ft = {
				javascript = { "prettierd" },
				typescript = { "prettierd" },
				javascriptreact = { "prettierd" },
				typescriptreact = { "prettierd" },
				svelte = { "prettierd" },
				css = { "prettierd" },
				html = { "prettierd" },
				json = { "prettierd" },
				yaml = { "prettierd", "yamllint" },
				markdown = { "prettierd" },
				graphql = { "prettierd" },
				lua = { "stylua" },
				python = function(bufnr)
					if conform.get_formatter_info("ruff_format", bufnr).available then
						return { "ruff_format" }
					else
						return { "isort", "black" }
					end
				end,
				go = { "goimports", "gofmt" },
				terraform = { "terraform_fmt", "tfsec" },
				jinja = { "prettierd" },
				ruby = { "rubocop", "solargraph" },
				rust = { "rustfmt" },
				["yaml.ansible"] = { "prettier", "ansible_lint" },
				-- Use the "*" filetype to run formatters on all filetypes.
				-- ["*"] = { "codespell" }, -- This might format ssl credentials!!!!!!!!!!!
				-- Use the "_" filetype to run formatters on filetypes that don't
				-- have other formatters configured.
				["_"] = { "trim_whitespace" },
			},
			format_on_save = function(bufnr)
				if vim.g.disable_autoformat or vim.b[bufnr].disable_autoformat then
					return
				end
				return { lsp_fallback = true, timeout_ms = 1500, async = false }
			end,
			log_level = vim.log.levels.ERROR,
			-- Conform will notify you when a formatter errors
			notify_on_error = true,
		})
	end,
}

return M
