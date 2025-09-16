return {
  {
    "zbirenbaum/copilot.lua",
    cmd = { "Copilot" },
    event = "InsertEnter",
    config = function()
      require("copilot").setup {
        suggestion = { enabled = true },
        panel = { enabled = false },
      }
    end,
  },
  {
    "olimorris/codecompanion.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-treesitter/nvim-treesitter",
      {
        "MeanderingProgrammer/render-markdown.nvim",
        ft = { "codecompanion", "markdown" },
      },
    },
    keys = {
      { "<leader>cc" .. "a", "<cmd>CodeCompanionActions<cr>", mode = { "n", "v" }, desc = "(AI) Action Palette" },
      { "<leader>cc" .. "c", "<cmd>CodeCompanionChat<cr>", mode = { "n", "v" }, desc = "(AI) New Chat" },
      { "<leader>cc" .. "A", "<cmd>CodeCompanionAdd<cr>", mode = "v", desc = "(AI) Add Code" },
      { "<leader>cc" .. "i", "<cmd>CodeCompanion<cr>", mode = "n", desc = "(AI) Inline Prompt" },
      { "<leader>cc" .. "C", "<cmd>CodeCompanionToggle<cr>", mode = "n", desc = "(AI) Toggle Chat" },
    },
    opts = {
      -- NOTE: The log_level is in `opts.opts`
      strategies = {
        -- default chat adapter
        chat = {
          adapter = "copilot",
        },
        inline = {
          adapter = "copilot",
        },
        actions = {
          adapter = "copilot",
        },
      },
      opts = {
        log_level = "ERROR",
        language = "English",
      },
    },
  },
}
