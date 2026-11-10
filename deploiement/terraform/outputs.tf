# Sorties Terraform (§4.2)

output "server_ip" {
  description = "Adresse IP du serveur de déploiement"
  value       = var.server_ip
}

output "ssh_connection" {
  description = "Commande de connexion SSH au serveur"
  value       = "ssh ${var.ssh_user}@${var.server_ip}"
}

output "deploy_dir" {
  description = "Répertoire de déploiement sur le serveur"
  value       = var.deploy_dir
}

output "ansible_inventory" {
  description = "Inventaire Ansible généré"
  value       = local_file.ansible_inventory.filename
}
