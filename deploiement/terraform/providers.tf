# Providers Terraform (§4.2)
#
# Environnement disponible : VMware Workstation, sans ESXi/vCenter.
# Le provider vSphere ne peut donc pas créer la VM : elle a été créée
# manuellement (Ubuntu Server 24.04, 2 vCPU, 4 Go RAM, 30 Go, NAT, SSH).
# Terraform décrit ce serveur et produit l'inventaire utilisé par Ansible.

terraform {
  required_version = ">= 1.6"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

provider "local" {}
