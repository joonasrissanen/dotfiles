local config = {
  root = vim.fn.stdpath "data" .. "/lazy",
  defaults = { lazy = true },
  install = {
    missing = true,
    colorscheme = { "rose-pine-moon" },
  },
  spec = {
    { import = "plugins" },
  },
  change_detection = { enabled = true, notify = false },
}

local lazypath = config.root .. "/lazy.nvim"

if not vim.loop.fs_stat(lazypath) then
  vim.fn.system {
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", -- latest stable release
    lazypath,
  }
end

vim.opt.rtp:prepend(lazypath)

local lazy_ok, lazy = pcall(require, "lazy")

-- Check if lazy.nvim is loaded successfully
if not lazy_ok then
  vim.api.nvim_echo({
    { ("Unable to load lazy from: %s\n"):format(lazypath), "ErrorMsg" },
    { "Press any key to exit...", "MoreMsg" },
  }, true, {})
  vim.fn.getchar()
  vim.cmd.quit()
end

lazy.setup(config)
