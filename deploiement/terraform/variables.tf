# Description du serveur de déploiement (§4.2)
# Aucune valeur secrète ici : la clé privée n'est désignée que par son chemin
# sur le poste qui lance Ansible, elle n'est jamais versionnée.

variable "server_name" {
  description = "Nom du serveur de déploiement (VM VMware Workstation)"
  type        = string
  default     = "souverainrecrut"
}

variable "server_ip" {
  description = "Adresse IP de la VM (réseau NAT VMware)"
  type        = string
  default     = "192.168.42.129"

  validation {
    condition     = can(cidrhost("${var.server_ip}/32", 0))
    error_message = "server_ip doit être une adresse IPv4 valide."
  }
}

variable "ssh_user" {
  description = "Utilisateur SSH utilisé par Ansible"
  type        = string
  default     = "yanis"
}

variable "ssh_private_key_path" {
  description = "Chemin de la clé privée SSH de déploiement sur le poste Ansible (hors dépôt)"
  type        = string
  default     = "~/.ssh/souverainrecrut_deploy"
}

variable "deploy_dir" {
  description = "Répertoire de déploiement à créer sur le serveur"
  type        = string
  default     = "/opt/souverainrecrut"
}

variable "inventory_path" {
  description = "Fichier d'inventaire Ansible généré"
  type        = string
  default     = "../ansible/inventory.ini"
}
