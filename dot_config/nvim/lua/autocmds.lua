local autocmd = vim.api.nvim_create_autocmd

-- -- user event that loads after UIEnter + only if file buf is there
-- autocmd({ "UIEnter", "BufReadPost", "BufNewFile" }, {
--   group = vim.api.nvim_create_augroup("NvFilePost", { clear = true }),
--   callback = function(args)
--     local file = vim.api.nvim_buf_get_name(args.buf)
--     local buftype = vim.api.nvim_get_option_value("buftype", { buf = args.buf })
--
--     if not vim.g.ui_entered and args.event == "UIEnter" then
--       vim.g.ui_entered = true
--     end
--
--     if file ~= "" and buftype ~= "nofile" and vim.g.ui_entered then
--       vim.api.nvim_exec_autocmds("User", { pattern = "FilePost", modeline = false })
--       vim.api.nvim_del_augroup_by_name "NvFilePost"
--
--       vim.schedule(function()
--         vim.api.nvim_exec_autocmds("FileType", {})
--
--         if vim.g.editorconfig then
--           require("editorconfig").config(args.buf)
--         end
--       end)
--     end
--   end,
-- })

-- apply dotenv changes automatically on save
autocmd("BufWritePost", {
  pattern = vim.fn.expand "~" .. "/.local/share/chezmoi/*",
  command = 'silent ! chezmoi apply --source-path "%"',
})

autocmd("BufWritePre", {
  pattern = "*.go",
  callback = function()
    local params = vim.lsp.util.make_range_params()
    params.context = { only = { "source.organizeImports" } }
    -- buf_request_sync defaults to a 1000ms timeout. Depending on your
    -- machine and codebase, you may want longer. Add an additional
    -- argument after params if you find that you have to write the file
    -- twice for changes to be saved.
    -- E.g., vim.lsp.buf_request_sync(0, "textDocument/codeAction", params, 3000)
    local result = vim.lsp.buf_request_sync(0, "textDocument/codeAction", params)
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
})
