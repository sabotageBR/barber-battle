#!/usr/bin/env bash
#
# Deploy do servidor do Barber Battle: testes -> docker build -> docker push -> kubernetes.
# Molde: gettvid/kubernetes/bin/deploy.sh.
#
#   kubernetes/bin/deploy.sh                # tag = git rev-parse --short=7 HEAD
#   kubernetes/bin/deploy.sh 0.1.0 --aplicar  # primeira vez: aplica os manifests antes do set image
#   kubernetes/bin/deploy.sh --rollback     # volta para a revisao anterior
#
# Opcoes:
#   --aplicar      kubectl apply -f kubernetes/ antes do set image
#   --force        reconstroi uma tag que ja existe no Docker Hub
#   --no-push      build local apenas
#   --dry-run      mostra o que seria feito e sai
#
# Variaveis: BB_IMAGE_REPO (padrao trixtecnologia/barberbattle-server, a conta logada no docker via sudo)
#             BB_KUBECONFIG  BB_KUBECTL  BB_ROLLOUT_TIMEOUT  BB_URL_PUBLICA
set -euo pipefail

IMAGE_REPO="${BB_IMAGE_REPO:-trixtecnologia/barberbattle-server}"
NAMESPACE="barberbattle"
DEPLOYMENT="barberbattle-server"
CONTAINER="server"

KUBECONFIG_FILE="${BB_KUBECONFIG:-/home/trixti/.config/OpenLens/kubeconfigs/70f08c4b-dcca-455b-96b1-b5661c1a2b95}"
KUBECTL_BIN="${BB_KUBECTL:-/home/trixti/.config/OpenLens/binaries/kubectl/1.21.14/kubectl}"
[ -x "$KUBECTL_BIN" ] || KUBECTL_BIN="$(command -v kubectl || true)"
ROLLOUT_TIMEOUT="${BB_ROLLOUT_TIMEOUT:-300s}"
URL_PUBLICA="${BB_URL_PUBLICA:-http://barberbattle.io}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

TAG=""; FORCE=0; NO_PUSH=0; DRY_RUN=0; ROLLBACK=0; APLICAR=0

c_reset=$'\033[0m'; c_step=$'\033[1;36m'; c_ok=$'\033[1;32m'; c_warn=$'\033[1;33m'; c_err=$'\033[1;31m'
step() { printf '\n%s==> %s%s\n' "$c_step" "$*" "$c_reset"; }
ok()   { printf '%s  ok%s %s\n' "$c_ok" "$c_reset" "$*"; }
warn() { printf '%s  aviso%s %s\n' "$c_warn" "$c_reset" "$*"; }
die()  { printf '\n%serro:%s %s\n' "$c_err" "$c_reset" "$*" >&2; exit 1; }
kc() { KUBECONFIG="$KUBECONFIG_FILE" "$KUBECTL_BIN" "$@"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --aplicar)  APLICAR=1 ;;
    --force)    FORCE=1 ;;
    --no-push)  NO_PUSH=1 ;;
    --dry-run)  DRY_RUN=1 ;;
    --rollback) ROLLBACK=1 ;;
    -h|--help)  sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)         die "opcao desconhecida: $1" ;;
    *)          [ -z "$TAG" ] || die "tag informada duas vezes: $TAG e $1"; TAG="$1" ;;
  esac
  shift
done

step "Verificando pre-requisitos"
[ -f "$REPO_ROOT/servidor/Dockerfile" ] || die "servidor/Dockerfile nao encontrado"
[ -f "$REPO_ROOT/servidor/package-lock.json" ] || die "servidor/package-lock.json nao encontrado (rode npm run servidor:instalar)"
[ -x "$KUBECTL_BIN" ] || die "kubectl nao encontrado"
[ -r "$KUBECONFIG_FILE" ] || die "kubeconfig ilegivel: $KUBECONFIG_FILE"
sudo -n true 2>/dev/null || die "sudo esta pedindo senha. Rode 'sudo -v' antes."
sudo -n docker version --format '{{.Server.Version}}' >/dev/null 2>&1 || die "nao consigo falar com o docker via sudo"
ok "docker (sudo) e kubectl disponiveis"

if [ "$ROLLBACK" = 1 ]; then
  step "Rollback do deployment $DEPLOYMENT"
  [ "$DRY_RUN" = 1 ] && { echo "kubectl -n $NAMESPACE rollout undo deploy/$DEPLOYMENT"; exit 0; }
  kc -n "$NAMESPACE" rollout undo "deploy/$DEPLOYMENT"
  kc -n "$NAMESPACE" rollout status "deploy/$DEPLOYMENT" --timeout="$ROLLOUT_TIMEOUT"
  kc -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}'; echo
  exit 0
fi

if [ -z "$TAG" ]; then
  TAG="$(git -C "$REPO_ROOT" rev-parse --short=7 HEAD 2>/dev/null || date +%Y%m%d-%H%M)"
  if [ -n "$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null)" ]; then warn "arvore de trabalho suja (a tag $TAG nao reflete tudo)"; fi
fi
IMAGE="$IMAGE_REPO:$TAG"

if kc -n "$NAMESPACE" get deploy "$DEPLOYMENT" >/dev/null 2>&1; then
  ATUAL="$(kc -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}')"
  [ "$ATUAL" = "$IMAGE" ] && [ "$FORCE" = 0 ] && die "a imagem $IMAGE ja esta no cluster (use --force)"
else
  [ "$APLICAR" = 1 ] || die "deployment $DEPLOYMENT nao existe no namespace $NAMESPACE: use --aplicar na primeira vez"
fi

if [ "$DRY_RUN" = 1 ]; then
  step "Dry-run"
  echo "1/5 npm test"
  echo "2/5 sudo docker build -t $IMAGE -f servidor/Dockerfile $REPO_ROOT"
  echo "3/5 sudo docker push $IMAGE"
  [ "$APLICAR" = 1 ] && echo "4/5 kubectl apply -f kubernetes/"
  echo "4/5 kubectl -n $NAMESPACE set image deploy/$DEPLOYMENT $CONTAINER=$IMAGE"
  echo "5/5 validar: /healthz no pod, $URL_PUBLICA/healthz, handshake WebSocket"
  exit 0
fi

step "1/5 Testes"
(cd "$REPO_ROOT" && npm test >/dev/null) || die "npm test falhou"
ok "testes verdes"

step "2/5 Build da imagem $IMAGE"
if [ "$FORCE" = 0 ] && sudo -n docker manifest inspect "$IMAGE" >/dev/null 2>&1; then die "a tag $IMAGE ja existe no Docker Hub (use --force)"; fi
sudo -n docker build -t "$IMAGE" -f "$REPO_ROOT/servidor/Dockerfile" "$REPO_ROOT"
ok "imagem construida"
[ "$NO_PUSH" = 1 ] && { warn "--no-push: parando aqui"; exit 0; }

step "3/5 Push"
sudo -n docker push "$IMAGE"
ok "imagem publicada"

step "4/5 Kubernetes"
if [ "$APLICAR" = 1 ]; then
  kc apply -f "$REPO_ROOT/kubernetes/"
  ok "manifests aplicados"
fi
kc -n "$NAMESPACE" set image "deploy/$DEPLOYMENT" "$CONTAINER=$IMAGE"
kc -n "$NAMESPACE" annotate "deploy/$DEPLOYMENT" kubernetes.io/change-cause="deploy.sh $IMAGE $(date -Iseconds)" --overwrite >/dev/null
if ! kc -n "$NAMESPACE" rollout status "deploy/$DEPLOYMENT" --timeout="$ROLLOUT_TIMEOUT"; then
  warn "rollout falhou: voltando"
  kc -n "$NAMESPACE" rollout undo "deploy/$DEPLOYMENT"
  kc -n "$NAMESPACE" rollout status "deploy/$DEPLOYMENT" --timeout="$ROLLOUT_TIMEOUT" || true
  die "deploy revertido"
fi
ok "rollout concluido"

step "5/5 Validacao"
POD=""
for _ in $(seq 1 30); do
  POD="$(kc -n "$NAMESPACE" get pods -l app.kubernetes.io/name="$DEPLOYMENT" -o json | python3 -c "
import json,sys
for p in json.load(sys.stdin)['items']:
    if p['metadata'].get('deletionTimestamp'): continue
    if any(c['image']=='$IMAGE' for c in p['spec']['containers']) and p['status'].get('phase')=='Running': print(p['metadata']['name']); break
")"
  [ -n "$POD" ] && break
  sleep 2
done
[ -n "$POD" ] || die "nenhum pod Running com a imagem nova"
kc -n "$NAMESPACE" exec "$POD" -- wget -qO- http://127.0.0.1:3000/healthz; echo
ok "healthz no pod $POD"
if curl -fsS --max-time 8 "$URL_PUBLICA/healthz" >/dev/null; then ok "$URL_PUBLICA/healthz responde"; else warn "$URL_PUBLICA/healthz nao respondeu (ingress/DNS?)"; fi
WS_URL="$(echo "$URL_PUBLICA" | sed -e 's#^https://#wss://#' -e 's#^http://#ws://#')/ws"
if node -e "const w=new WebSocket('$WS_URL');const t=setTimeout(()=>{console.log('timeout');process.exit(1)},6000);w.onopen=()=>{clearTimeout(t);console.log('handshake ok');w.close();process.exit(0)};w.onerror=()=>{clearTimeout(t);process.exit(1)}" 2>/dev/null; then ok "WebSocket em $WS_URL"; else warn "WebSocket em $WS_URL nao abriu"; fi
kc -n "$NAMESPACE" get pods -o wide
printf '\nPara voltar: %s --rollback\n' "${BASH_SOURCE[0]}"
