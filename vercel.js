{
"rewrites": [
{ "source": "/classroom/:id", "destination": "/api/classroom/[id]" }
],
"builds": [
{ "src": "api/.js", "use": "@vercel/node" },
{ "src": "api/classroom/.js", "use": "@vercel/node" }
]
}
