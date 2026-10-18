FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/
COPY shared/ /usr/share/nginx/html/shared/
COPY catalogo/ /usr/share/nginx/html/catalogo/
COPY login/ /usr/share/nginx/html/login/

EXPOSE 3000
