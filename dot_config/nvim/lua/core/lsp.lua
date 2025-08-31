local handlers = require "core.handlers"
local lsp_dir = vim.fn.stdpath "config" .. "/lsp"

local enabled_servers = vim.g.lsp_enabled_servers or {}

local function get_lsp_servers()
  local servers = {}
  if vim.fn.isdirectory(lsp_dir) == 1 then
    local files = vim.fn.readdir(lsp_dir)
    for _, file in ipairs(files) do
      if file:match "%.lua$" then
        local server_name = file:gsub("%.lua$", "")
        table.insert(servers, server_name)
      end
    end
  end
  return servers
end

local function setup_lsp(server)
  local ok, server_config = pcall(dofile, vim.fn.stdpath "config" .. "/lsp" .. "/" .. server .. ".lua")
  if not ok then
    vim.api.nvim_echo({
      { ("Error configuring LSP server: %s"):format(server, server_config), "ErrorMsg" },
    }, true, {})
    return
  end

  local group = vim.api.nvim_create_augroup("Lsp" .. server, { clear = true })
  vim.api.nvim_create_autocmd({ "FileType" }, {
    group = group,
    pattern = server_config.filetypes,
    callback = function()
      if enabled_servers[server] then
        return
      end
      vim.lsp.enable(server)
      enabled_servers[server] = true
    end,
  })

  local attached_buffers = {}
  vim.api.nvim_create_autocmd("LspAttach", {
    group = group,
    callback = function(args)
      local client = vim.lsp.get_client_by_id(args.data.client_id)
      if client and client.name == server then
        attached_buffers[args.buf] = true

        vim.api.nvim_create_autocmd({ "BufDelete", "BufWipeout" }, {
          buffer = args.buf,
          once = true,
          callback = function()
            attached_buffers[args.buf] = nil
            if next(attached_buffers) == nil then
              local active_clients = vim.lsp.get_clients { name = server }
              vim.lsp.stop_client(active_clients)
              enabled_servers[server] = false
            end
          end,
        })
      end
    end,
  })
end

vim.hl.priorities.semantic_tokens = 95 -- Or any number lower than 100, treesitter's priority level
-- Appearance of diagnostics
vim.diagnostic.config {
  virtual_text = {
    prefix = "●",
    -- Add a custom format function to show error codes
    format = function(diagnostic)
      local code = diagnostic.code and string.format("[%s]", diagnostic.code) or ""
      return string.format("%s %s", code, diagnostic.message)
    end,
  },
  underline = true,
  update_in_insert = true,
  float = {
    source = true, -- Or "if_many"
  },
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = " ",
      [vim.diagnostic.severity.WARN] = " ",
      [vim.diagnostic.severity.INFO] = " ",
      [vim.diagnostic.severity.HINT] = "󰌵 ",
    },
  },
}

vim.lsp.config("*", {
  capabilities = handlers.capabilities,
})

vim.api.nvim_create_autocmd({ "LspAttach" }, {
  group = vim.api.nvim_create_augroup("Lsp", { clear = true }),
  callback = function(args)
    local client = vim.lsp.get_client_by_id(args.data.client_id)
    if client then
      handlers.on_attach(client, args.buf)
    end
  end,
})

for _, server in ipairs(get_lsp_servers()) do
  setup_lsp(server)
end
