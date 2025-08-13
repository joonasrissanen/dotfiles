--- https://github.com/redhat-developer/yaml-language-server
return {
  cmd = {
    "yaml-language-server",
    "--stdio",
  },
  filetypes = { "yaml" },
  root_markers = { ".git" },
  single_file_support = true,
}
