--- https://github.com/golang/tools/tree/master/gopls

local function on_attach()
  local autoimport = vim.api.nvim_create_augroup("joonasrissanen/lsp/gopls/autoimport", { clear = true })
  vim.api.nvim_create_autocmd("BufWritePre", {
    pattern = "*.go",
    callback = function(args)
      -- Check if formatting is disabled for this specific buffer
      local bufnr = args.buf
      if vim.g.disable_autoformat or vim.b[bufnr].disable_autoformat then
        return
      end

      local params = vim.lsp.util.make_range_params(nil, nil, bufnr)
      params.context = { only = { "source.organizeImports" } }
      -- buf_request_sync defaults to a 1000ms timeout. Depending on your
      -- machine and codebase, you may want longer. Add an additional
      -- argument after params if you find that you have to write the file
      -- twice for changes to be saved.
      -- E.g., vim.lsp.buf_request_sync(0, "textDocument/codeAction", params, 3000)
      local result = vim.lsp.buf_request_sync(bufnr, "textDocument/codeAction", params)
      for cid, res in pairs(result or {}) do
        for _, r in pairs(res.result or {}) do
          if r.edit then
            local enc = (vim.lsp.get_client_by_id(cid) or {}).offset_encoding or "utf-16"
            vim.lsp.util.apply_workspace_edit(r.edit, enc)
          end
        end
      end
      vim.lsp.buf.format { async = false }
    end,
    group = autoimport,
  })
end

return {
  cmd = { "gopls" },
  filetypes = { "go", "gomod", "gosum", "gowork", "gotmpl" },
  root_markers = { "go.mod", "go.work", ".git" },
  settings = {
    gopls = {
      gofumpt = true,
      analyses = {
        unusedparams = true,
      },
      staticcheck = true,
    },
  },
  on_attach = on_attach,
  on_exit = function()
    vim.schedule(function()
      vim.api.nvim_clear_autocmds { group = "joonasrissanen/lsp/gopls/autoimport" }
    end)
  end,
}
