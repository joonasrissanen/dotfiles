local M = {}
local map = vim.keymap.set

M.on_attach = function(_, bufnr)
  local function opts(desc)
    return { buffer = bufnr, desc = "LSP " .. desc }
  end

  local complete_client = function(arg)
    return vim
      .iter(vim.lsp.get_clients())
      :map(function(client)
        return client.name
      end)
      :filter(function(name)
        return name:sub(1, #arg) == arg
      end)
      :totable()
  end

  local complete_config = function(arg)
    return vim
      .iter(vim.api.nvim_get_runtime_file(('lsp/%s*.lua'):format(arg), true))
      :map(function(path)
        local file_name = path:match('[^/]*.lua$')
        return file_name:sub(0, #file_name - 4)
      end)
      :totable()
  end

  vim.api.nvim_create_user_command('LspInfo', ':checkhealth vim.lsp', { desc = 'Alias to `:checkhealth vim.lsp`' })

  vim.api.nvim_create_user_command("LspLogs", function()
    local log_path = vim.lsp.get_log_path()
    if log_path then
      vim.cmd("edit " .. log_path)
    else
      vim.notify("No LSP logs found", vim.log.levels.WARN)
    end
  end, { nargs = 0, desc = "Show LSP logs" })

  vim.api.nvim_create_user_command('LspRestart', function(info)
    local clients = info.fargs

    -- Default to restarting all active servers
    if #clients == 0 then
      clients = vim
        .iter(vim.lsp.get_clients())
        :map(function(client)
          return client.name
        end)
        :totable()
    end

    for _, name in ipairs(clients) do
      if vim.lsp.config[name] == nil then
        vim.notify(("Invalid server name '%s'"):format(name))
      else
        vim.lsp.enable(name, false)
      end
    end

    local timer = assert(vim.uv.new_timer())
    timer:start(500, 0, function()
      for _, name in ipairs(clients) do
        vim.schedule_wrap(function(x)
          vim.lsp.enable(x)
        end)(name)
      end
    end)
  end, {
    desc = 'Restart the given client',
    nargs = '?',
    complete = complete_client,
  })

  map("n", "gD", vim.lsp.buf.declaration, opts "Go to declaration")
  map("n", "gd", vim.lsp.buf.definition, opts "Go to definition")
  map("n", "<leader>wa", vim.lsp.buf.add_workspace_folder, opts "Add workspace folder")
  map("n", "<leader>wr", vim.lsp.buf.remove_workspace_folder, opts "Remove workspace folder")

  map("n", "<leader>wl", function()
    print(vim.inspect(vim.lsp.buf.list_workspace_folders()))
  end, opts "List workspace folders")

  map("n", "<leader>D", vim.lsp.buf.type_definition, opts "Go to type definition")
  map("n", "<leader>ra", require "core.renamer", opts "NvRenamer")
end

M.capabilities = vim.lsp.protocol.make_client_capabilities()

return M
