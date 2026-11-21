# ==============================================================================
# ResQTrack Incident AI System Detection -- Backend Web API Service
# Multi-Stage Portable Build: .NET 10 SDK (Build) -> ASP.NET Core 10 Runtime
# ==============================================================================

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore dependencies first to maximize Docker build layer caching
COPY Backend.csproj ./
RUN dotnet restore Backend.csproj

# Copy source and publish platform-agnostic runtime output
COPY . .
RUN dotnet publish Backend.csproj -c Release -o /app/publish /p:UseAppHost=false

# Final lightweight ASP.NET Core 10 runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libgssapi-krb5-2 python3 python3-venv libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/roboflow-venv \
    && /opt/roboflow-venv/bin/pip install --no-cache-dir "inference-sdk>=1.5.0"
ENV PATH="/opt/roboflow-venv/bin:${PATH}"

COPY --from=build /app/publish .
RUN mkdir -p /app/server-data/uploads/captures /app/server-data/uploads/reports /app/LocalConfig

EXPOSE 1999
ENV ASPNETCORE_URLS=http://0.0.0.0:1999
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "Backend.dll"]
