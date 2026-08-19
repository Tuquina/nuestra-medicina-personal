# ADR 0001: alojar producción en Netcup VPS 500 G12

## Context

La arquitectura inicial suponía un DigitalOcean Basic Droplet de 1 vCPU,
1 GB de RAM y aproximadamente 25 GB de disco. El proyecto continúa siendo una
tienda personal de muy bajo tráfico, pero Netcup ofrece más margen operativo a
menor costo para el servidor elegido.

La ficha oficial vigente del VPS 500 G12 indica 2 vCore x86, 4 GB DDR5 ECC,
128 GB NVMe, tráfico incluido y snapshots Copy-On-Write:
https://www.netcup.com/en/server/vps

## Decision

Producción se desplegará inicialmente en un único Netcup VPS 500 G12 mediante
Docker Compose. Nginx, la API Go y PostgreSQL convivirán en el mismo host; los
eBooks y media usarán almacenamiento local con backups externos.

La mayor capacidad no cambia el stack ni habilita microservicios, Redis, colas
externas o compilación habitual en el VPS. Los límites de PostgreSQL y del pool
Go seguirán siendo conservadores y se ajustarán únicamente con métricas.

## Consequences

- Hay más margen de memoria, CPU y almacenamiento para el monolito.
- El runbook, backups, firewall y despliegue deben referirse a Netcup.
- Los snapshots del proveedor son complementarios; no sustituyen backups
  externos restaurables de PostgreSQL, eBooks y media.
- La elección de Gmail API ya no depende de restricciones SMTP de DigitalOcean:
  se mantiene por OAuth, dominio propio, menor carga operativa y desacoplamiento.

## Alternatives considered

- DigitalOcean Basic Droplet: menor capacidad por un costo superior para este
  caso concreto.
- Servicios administrados separados: innecesarios para la escala inicial.
- Compilar y operar más servicios en el VPS: descartado para conservar
  simplicidad y despliegues reproducibles desde CI.
