local function on_attach(bufnr)
  local gitsigns = require "gitsigns"
  local map = vim.keymap.set

  -- Navigation
  map("n", "<leader>gn", gitsigns.next_hunk, { buffer = bufnr, desc = "(gitsigns) Next hunk" })
  map("n", "<leader>gN", gitsigns.prev_hunk, { buffer = bufnr, desc = "(gitsigns) Previous hunk" })

  -- Actions
  map("n", "<leader>gd", gitsigns.diffthis, { buffer = bufnr, desc = "(gitsigns) Diff this" })
  map("n", "<leader>gs", gitsigns.stage_hunk, { buffer = bufnr, desc = "(gitsigns) Stage hunk" })
  map("n", "<leader>gu", gitsigns.undo_stage_hunk, { buffer = bufnr, desc = "(gitsigns) Unstage hunk" })
  map("n", "<leader>gr", gitsigns.reset_hunk, { buffer = bufnr, desc = "(gitsigns) Reset hunk" })
  map("n", "<leader>gp", gitsigns.preview_hunk, { buffer = bufnr, desc = "(gitsigns) Preview hunk" })
  map("n", "<leader>gb", gitsigns.blame_line, { buffer = bufnr, desc = "(gitsigns) Blame line" })
end

return {
  {
    "lewis6991/gitsigns.nvim",
    event = "User FilePost",
    opts = {
      on_attach = on_attach,
      signs = {
        delete = { text = "󰍵" },
        changedelete = { text = "󱕖" },
      },
      current_line_blame = true,
      current_line_blame_opts = {
        virt_text = true,
        virt_text_pos = "eol",
        delay = 1000,
        ignore_whitespace = false,
        virt_text_priority = 100,
      },
      current_line_blame_formatter = "<author>, <author_time:%Y-%m-%d> - <summary>",
    },
    config = function(_, opts)
      require("gitsigns").setup(opts)
    end,
  },
  {
    "kdheepak/lazygit.nvim",
    lazy = false,
    cmd = {
      "LazyGit",
      "LazyGitConfig",
      "LazyGitCurrentFile",
      "LazyGitFilter",
      "LazyGitFilterCurrentFile",
    },
    requires = {
      "nvim-telescope/telescope.nvim",
      "nvim-lua/plenary.nvim",
    },
    keys = {
      { "<leader>gg", "<cmd>LazyGit<cr>", desc = "LazyGit" },
    },
    config = function()
      require("telescope").load_extension "lazygit"
    end,
  },
}
