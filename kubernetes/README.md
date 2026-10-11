# Barber Battle no Kubernetes

Um container Node 22 serve o jogo estático (`/`, `/src/**`, `/LICENCAS.txt`), a política (`/privacidade`), o `/healthz` e o WebSocket (`/ws`). O padrão segue o War Space (namespace `warspace`): ingress-nginx com timeouts de uma hora, cert-manager com `letsencrypt-prod`.

## Registro de imagens
O `docker` desta máquina (via `sudo`) está logado como `trixtecnologia`, que não pode criar repositórios em `evandromoura/*`. Por isso a imagem vai para `trixtecnologia/barberbattle-server`. Para mudar: `BB_IMAGE_REPO=evandromoura/barberbattle-server kubernetes/bin/deploy.sh ...` depois de `sudo docker login` como `evandromoura`, e ajustar `20-deployment.yaml`.

## Primeira vez
```
sudo -v
kubernetes/bin/deploy.sh 0.1.0 --aplicar      # build, push, apply dos manifests e set image
curl -s http://barberbattle.io/healthz
```
`barberbattle.io` precisa apontar para 192.168.12.50 (no `/etc/hosts` enquanto o domínio não existe).

## Atualizações
```
kubernetes/bin/deploy.sh                     # tag = git rev-parse --short HEAD
kubernetes/bin/deploy.sh --rollback          # volta para a revisão anterior
kubernetes/bin/deploy.sh --dry-run           # só mostra
```
Deploy encerra as salas em andamento com "manutenção" (os clientes reconectam no saguão seguinte): não fazer durante testes da Poki.

## Fase B (domínio comprado)
1. Registrar `A barberbattle.io` e `A www.barberbattle.io` para o IP público do roteador do cluster (hoje `warspace.io` resolve para 177.190.160.19).
2. Esperar `dig +short barberbattle.io @1.1.1.1` responder.
3. Em `40-ingress.yaml`: `ssl-redirect: "true"`, descomentar `cert-manager.io/cluster-issuer: letsencrypt-prod` e o bloco `tls`.
4. Em `10-configmap.yaml`: tirar `http://barberbattle.io` de `ALLOWED_ORIGINS`.
5. `kubectl apply -f kubernetes/` e `kubectl -n barberbattle get certificate` até `Ready: True`.
6. Pedir à Poki (Settings → CSP) a liberação de `wss://barberbattle.io` e `https://barberbattle.io`, com a política em `https://barberbattle.io/privacidade`.

Opcionais em `kubernetes/opcional/`: `ClusterIssuer selfsigned` (wss pela LAN na fase A) e `NetworkPolicy`.
