# Ressources Terraform (§4.2)
#
# Pont Terraform -> Ansible : Terraform décrit le serveur de déploiement
# et génère l'inventaire SSH que le playbook Ansible utilisera (§4.3).

resource "local_file" "ansible_inventory" {
  filename        = var.inventory_path
  file_permission = "0644"

  content = <<-EOT
    # Inventaire généré par Terraform (deploiement/terraform) - ne pas modifier à la main
    [app]
    ${var.server_name} ansible_host=${var.server_ip} ansible_user=${var.ssh_user} ansible_ssh_private_key_file=${var.ssh_private_key_path}

    [app:vars]
    deploy_dir=${var.deploy_dir}
  EOT
}
