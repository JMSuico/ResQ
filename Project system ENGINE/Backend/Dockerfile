# ==============================================================================
# ResQTrack Incident AI System Detection -- Backend Web API Service
# Framework: .NET 10 (ASP.NET Core Web API)
# ==============================================================================

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Copy pre-compiled release publish output
COPY publish/ .

EXPOSE 5000
ENV ASPNETCORE_URLS=http://0.0.0.0:5000
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "Backend.dll"]
