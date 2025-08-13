--- https://github.com/hashicorp/terraform-ls
return {
  cmd = { "terraform-ls", "serve" },
  filetypes = { "terraform", "tf" },
  root_markers = { ".tf", ".tfvars", ".terraform.lock.hcl" },
}
