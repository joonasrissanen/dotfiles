-- Required by dap plugin
---@param config {args?:string[]|fun():string[]?}
local function get_args(config)
  local args = type(config.args) == "function" and (config.args() or {}) or config.args or {}
  config = vim.deepcopy(config)
  ---@cast args string[]
  config.args = function()
    local new_args = vim.fn.input("Run with args: ", table.concat(args, " ")) --[[@as string]]
    return vim.split(vim.fn.expand(new_args) --[[@as string]], " ")
  end
  return config
end

return {
  "nvim-lua/plenary.nvim",

  -- Nvchad UI
  {
    "nvchad/ui",
    config = function()
      require "nvchad"
    end,
  },

  {
    "nvchad/base46",
    lazy = true,
    build = function()
      require("base46").load_all_highlights()
    end,
  },

  {
    "stevearc/conform.nvim",
    event = "User FilePost",
    opts = function()
      return require "configs.plugin_conform"
    end,
  },

  {
    "lukas-reineke/indent-blankline.nvim",
    event = "User FilePost",
  },

  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    opts = {
      -- your configuration comes here
      -- or leave it empty to use the default settings
      -- refer to the configuration section below
    },
    keys = {
      {
        "<leader>?",
        function()
          require("which-key").show { global = false }
        end,
        desc = "Buffer Local Keymaps (which-key)",
      },
    },
  },

  {
    "nvim-neo-tree/neo-tree.nvim",
    cmd = "Neotree",
    deactivate = function()
      vim.cmd [[Neotree close]]
    end,
    dependencies = {
      "nvim-telescope/telescope.nvim",
      "nvim-lua/plenary.nvim",
      "nvim-tree/nvim-web-devicons",
      "MunifTanjim/nui.nvim",
      "s1n7ax/nvim-window-picker",
      "mrbjarksen/neo-tree-diagnostics.nvim",
    },
    keys = {
      {
        "<C-t>",
        function()
          require("neo-tree.command").execute { toggle = true }
        end,
        desc = "Toggle NeoTree",
      },
    },
    opts = function()
      return require "configs.plugin_neo-tree"
    end,
    config = function(_, opts)
      require("neo-tree").setup(opts)
    end,
  },

  {
    "nvim-telescope/telescope.nvim",
    dependencies = { "nvim-treesitter/nvim-treesitter" },
    cmd = "Telescope",
    keys = {
      -- telescope
      {
        "<leader>fw",
        "<cmd>Telescope live_grep<CR>",
        { desc = "telescope live grep" },
      },
      {
        "<leader>fb",
        "<cmd>Telescope buffers<CR>",
        { desc = "telescope find buffers" },
      },
      {
        "<leader>fh",
        "<cmd>Telescope help_tags<CR>",
        { desc = "telescope help page" },
      },
      {
        "<leader>ma",
        "<cmd>Telescope marks<CR>",
        { desc = "telescope find marks" },
      },
      {
        "<leader>fo",
        "<cmd>Telescope oldfiles<CR>",
        { desc = "telescope find oldfiles" },
      },
      {
        "<leader>fz",
        "<cmd>Telescope current_buffer_fuzzy_find<CR>",
        { desc = "telescope find in current buffer" },
      },
      {
        "<leader>cm",
        "<cmd>Telescope git_commits<CR>",
        { desc = "telescope git commits" },
      },
      {
        "<leader>gt",
        "<cmd>Telescope git_status<CR>",
        { desc = "telescope git status" },
      },
      {
        "<leader>pt",
        "<cmd>Telescope terms<CR>",
        { desc = "telescope pick hidden term" },
      },
      {
        "<leader>ff",
        "<cmd>Telescope find_files<cr>",
        { desc = "telescope find files" },
      },
      {
        "<leader>fa",
        "<cmd>Telescope find_files follow=true no_ignore=true hidden=true<CR>",
        { desc = "telescope find all files" },
      },
    },
    opts = function()
      return require "configs.plugin_telescope"
    end,
  },

  {
    "nvim-treesitter/nvim-treesitter",
    event = { "BufReadPost", "BufNewFile" },
    cmd = { "TSInstall", "TSBufEnable", "TSBufDisable", "TSModuleInfo" },
    build = ":TSUpdate",
    keys = {},
    opts = function()
      return require "configs.plugin_treesitter"
    end,
    config = function(_, opts)
      require("nvim-treesitter.configs").setup(opts)
    end,
  },

  -- TMUX
  {
    "christoomey/vim-tmux-navigator",
    cmd = {
      "TmuxNavigateLeft",
      "TmuxNavigateDown",
      "TmuxNavigateUp",
      "TmuxNavigateRight",
      "TmuxNavigatePrevious",
      "TmuxNavigatorProcessList",
    },
    keys = {
      { "<c-h>", "<cmd><C-U>TmuxNavigateLeft<cr>" },
      { "<c-j>", "<cmd><C-U>TmuxNavigateDown<cr>" },
      { "<c-k>", "<cmd><C-U>TmuxNavigateUp<cr>" },
      { "<c-l>", "<cmd><C-U>TmuxNavigateRight<cr>" },
      { "<c-\\>", "<cmd><C-U>TmuxNavigatePrevious<cr>" },
    },
  },

  -- git stuff
  {
    "lewis6991/gitsigns.nvim",
    event = "User FilePost",
    opts = function()
      return require "configs.plugin_gitsigns"
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

  -- LSP
  {
    "williamboman/mason.nvim",
    cmd = { "Mason", "MasonInstall", "MasonInstallAll", "MasonUpdate" },
    lazy = false,
    config = function(opts)
      require("mason").setup(opts)
    end,
    opts = function()
      local opts = require "configs.plugin_mason"

      vim.api.nvim_create_user_command("MasonInstallAll", function()
        vim.cmd("MasonInstall " .. table.concat(opts.ensure_installed, " "))
      end, {})
      return opts
    end,
  },
  {
    "neovim/nvim-lspconfig",
    event = "User FilePost",
    config = function()
      require "configs.plugin_lspconfig"
    end,
  },
  {
    "nvimtools/none-ls.nvim",
    event = "User FilePost",
    opts = function()
      return require "configs.plugin_null-ls"
    end,
  },

  {
    "github/copilot.vim",
    event = { "BufReadPre", "BufNewFile" },
    config = function()
      vim.g.copilot_no_tab_map = true
      vim.g.copilot_assume_mapped = true
      vim.api.nvim_set_keymap("i", "<C-O>", 'copilot#Accept("<CR>")', { silent = true, expr = true })
    end,
  },

  {
    "nvim-pack/nvim-spectre",
    dependencies = { "nvim-lua/plenary.nvim" },
    keys = {
      {
        "<leader>fr",
        "<cmd>lua require('spectre').toggle()<cr>",
        desc = "Toggle spectre",
      },
    },
    event = { "BufReadPre", "BufNewFile" },
    config = function()
      return require("spectre").setup {
        replace_engine = {
          ["sed"] = {
            cmd = "sed",
            args = {
              "-i",
              "",
              "-E",
            },
          },
        },
      }
    end,
  },

  {
    "mg979/vim-visual-multi",
    event = "User FilePost",
    config = function()
      vim.g.VM_maps["Get Operator"] = "<Leader>a"
      vim.g.VM_maps["Reselect Last"] = "<Leader>z"
      vim.g.VM_maps["Visual Cursors"] = "<Leader><Space>"
      vim.g.VM_maps["Undo"] = "u"
      vim.g.VM_maps["Redo"] = "<C-r>"
      vim.g.VM_maps["Visual Subtract"] = "zs"
      vim.g.VM_maps["Visual Reduce"] = "zr"
    end,
  },

  {
    "folke/noice.nvim",
    event = "VeryLazy",
    cmd = { "Noice" },
    dependencies = {
      -- if you lazy-load any plugin below, make sure to add proper `module="..."` entries
      "MunifTanjim/nui.nvim",
      -- OPTIONAL:
      --   `nvim-notify` is only needed, if you want to use the notification view.
      --   If not available, we use `mini` as the fallback
      "rcarriga/nvim-notify",
      "hrsh7th/nvim-cmp",
    },
    opts = {
      cmdline = {
        enabled = true, -- enables the Noice cmdline UI
        view = "cmdline_popup", -- view for rendering the cmdline. Change to `cmdline` to get a classic cmdline at the bottom
        opts = {}, -- global options for the cmdline. See section on views
        format = {
          -- conceal: (default=true) This will hide the text in the cmdline that matches the pattern.
          -- view: (default is cmdline view)
          -- opts: any options passed to the view
          -- icon_hl_group: optional hl_group for the icon
          -- title: set to anything or empty string to hide
          cmdline = { pattern = "^:", icon = "", lang = "vim" },
          search_down = {
            kind = "search",
            pattern = "^/",
            icon = " ",
            lang = "regex",
          },
          search_up = {
            kind = "search",
            pattern = "^%?",
            icon = " ",
            lang = "regex",
          },
          shell = { pattern = "^:%s*!", icon = "$", lang = "bash" },
          lua = {
            pattern = { "^:%s*lua%s+", "^:%s*lua%s*=%s*", "^:%s*=%s*" },
            icon = "",
            lang = "lua",
          },
          help = { pattern = "^:%s*he?l?p?%s+", icon = "❓" },
          input = {}, -- Used by input()
          -- lua = false, -- to disable a format, set to `false`
        },
      },
      messages = { enabled = false },
      notify = { enabled = false },
      status = { enabled = false },
      lsp = {
        progress = {
          enabled = false,
        },
        signature = {
          enabled = false,
        },
        hover = {
          enabled = false,
        },
      },
    },
    config = function(_, opts)
      require("noice").setup(opts)
      require("notify").setup {
        background_colour = "#000000",
      }
    end,
  },

  -- DAP
  {
    "mfussenegger/nvim-dap",
    event = "VeryLazy",
    -- stylua: ignore
    keys = {
      { "<leader>dB", function() require("dap").set_breakpoint(vim.fn.input('Breakpoint condition: ')) end, desc = "Breakpoint Condition" },
      { "<leader>db", function() require("dap").toggle_breakpoint() end, desc = "Toggle Breakpoint" },
      { "<leader>dc", function() require("dap").continue() end, desc = "Continue" },
      { "<leader>da", function() require("dap").continue({ before = get_args }) end, desc = "Run with Args" },
      { "<leader>dC", function() require("dap").run_to_cursor() end, desc = "Run to Cursor" },
      { "<leader>dg", function() require("dap").goto_() end, desc = "Go to line (no execute)" },
      { "<leader>di", function() require("dap").step_into() end, desc = "Step Into" },
      { "<leader>dj", function() require("dap").down() end, desc = "Down" },
      { "<leader>dk", function() require("dap").up() end, desc = "Up" },
      { "<leader>dl", function() require("dap").run_last() end, desc = "Run Last" },
      { "<leader>do", function() require("dap").step_out() end, desc = "Step Out" },
      { "<leader>dO", function() require("dap").step_over() end, desc = "Step Over" },
      { "<leader>dp", function() require("dap").pause() end, desc = "Pause" },
      { "<leader>dr", function() require("dap").repl.toggle() end, desc = "Toggle REPL" },
      { "<leader>ds", function() require("dap").session() end, desc = "Session" },
      { "<leader>dq", function() require("dap").terminate() end, desc = "Terminate" },
      { "<leader>dw", function() require("dap.ui.widgets").hover() end, desc = "Widgets" },
      { "<leader>du", function() require("dapui").toggle({ }) end, desc = "Dap UI" },
      { "<leader>de", function() require("dapui").eval() end, desc = "Eval", mode = {"n", "v"} },
    },
    dependencies = {
      -- virtual text for the debugger
      { "theHamsta/nvim-dap-virtual-text" },
      -- fancy UI for the debugger
      { "rcarriga/nvim-dap-ui", dependencies = { "nvim-neotest/nvim-nio" } },
      --- languages
      {
        "jay-babu/mason-nvim-dap.nvim",
        dependencies = { "williamboman/mason.nvim" },
        cmd = { "DapInstall", "DapUninstall" },
      },
      -- dap cmp source
      { "rcarriga/cmp-dap" },
    },
    config = function()
      require "configs.plugin_dap"
    end,
  },

  -- Disable nvim-tree
  {
    "nvim-tree/nvim-tree.lua",
    enabled = false,
  },
}
